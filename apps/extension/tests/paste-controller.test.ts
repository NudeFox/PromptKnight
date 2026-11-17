import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installPasteProtection } from '../src/paste/controller';
import { captureEditor, type EditorSnapshot } from '../src/paste/editor';
import { showWarning, type Choice } from '../src/paste/dialog';
import type {
  DetectionEngine,
  ScanResult,
} from '@promptknight/detection-engine';
vi.mock('../src/paste/editor', () => ({ captureEditor: vi.fn() }));
vi.mock('../src/paste/dialog', () => ({ showWarning: vi.fn() }));

const finding = {
  id: 'SYNTHETIC_1',
  type: 'SYNTHETIC',
  severity: 'high' as const,
  start: 0,
  end: 9,
  replacement: '[SYNTHETIC_1]',
};
let listeners: Map<string, EventListener>;
let doc: Document;
let editor: EditorSnapshot;
let engine: DetectionEngine;
let choose: (choice: Choice) => void;
let closed: () => void;
let removed: () => void;
let view: ReturnType<typeof showWarning>;
let controller: ReturnType<typeof installPasteProtection>;
function paste(
  options: {
    trusted?: boolean;
    data?: string;
    available?: boolean;
    prevented?: boolean;
    types?: string[];
  } = {},
) {
  const event = {
    isTrusted: options.trusted ?? true,
    defaultPrevented: options.prevented ?? false,
    preventDefault: vi.fn(),
    stopImmediatePropagation: vi.fn(),
    composedPath: () => [null],
    clipboardData:
      options.available === false
        ? null
        : {
            types: options.types ?? ['text/plain'],
            getData: () => options.data ?? 'synthetic',
          },
  };
  listeners.get('paste')!(event as unknown as Event);
  return event;
}
beforeEach(() => {
  listeners = new Map();
  const addEventListener = (
    type: string,
    listener: EventListener,
    options: AddEventListenerOptions,
  ) => {
    listeners.set(type, listener);
    options.signal?.addEventListener('abort', () => {
      if (listeners.get(type) === listener) listeners.delete(type);
    });
  };
  doc = {
    defaultView: { addEventListener },
    addEventListener,
    documentElement: {},
  } as unknown as Document;
  vi.stubGlobal(
    'MutationObserver',
    class {
      constructor(callback: () => void) {
        removed = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  editor = { restore: vi.fn(), insert: vi.fn(() => true) };
  vi.mocked(captureEditor).mockReturnValue(editor);
  engine = {
    scan: vi.fn((): ScanResult => ({ findings: [finding], truncated: false })),
    redact: vi.fn(() => '[SYNTHETIC_1]'),
  };
  closed = vi.fn();
  view = {
    close: closed,
    failed: vi.fn(),
    host: { isConnected: true } as HTMLElement,
  };
  vi.mocked(showWarning).mockImplementation((_warning, callback) => {
    choose = callback;
    return view;
  });
  controller = installPasteProtection(doc, engine, showWarning);
});
afterEach(() => {
  controller.stop();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe('synchronous paste decisions', () => {
  it('fails closed if editor inspection throws', () => {
    vi.mocked(captureEditor).mockImplementationOnce(() => {
      throw new Error('Synthetic adapter failure');
    });
    expect(paste().preventDefault).toHaveBeenCalledOnce();
    expect(engine.scan).not.toHaveBeenCalled();
  });
  it('ignores untrusted and previously cancelled events', () => {
    expect(paste({ trusted: false }).preventDefault).not.toHaveBeenCalled();
    expect(paste({ prevented: true }).preventDefault).not.toHaveBeenCalled();
    expect(engine.scan).not.toHaveBeenCalled();
  });
  it('ignores non-editors, password, disabled and read-only fields classified by the adapter', () => {
    vi.mocked(captureEditor).mockReturnValue(null);
    expect(paste().preventDefault).not.toHaveBeenCalled();
    expect(engine.scan).not.toHaveBeenCalled();
  });
  it('allows native clean paste without restoring focus or selection', () => {
    vi.mocked(engine.scan).mockReturnValue({ findings: [], truncated: false });
    expect(paste().preventDefault).not.toHaveBeenCalled();
    expect(showWarning).not.toHaveBeenCalled();
    expect(editor.restore).not.toHaveBeenCalled();
  });
  it('blocks before opening a warning and renders sanitized text only', () => {
    const event = paste();
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopImmediatePropagation).toHaveBeenCalledOnce();
    expect(event.preventDefault.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(showWarning).mock.invocationCallOrder[0]!,
    );
    expect(showWarning).toHaveBeenCalledWith(
      expect.objectContaining({
        preview: '[SYNTHETIC_1]',
        findings: [finding],
      }),
      expect.any(Function),
    );
    expect(editor.insert).not.toHaveBeenCalled();
  });
  it.each(['cancel', 'redacted', 'original'] as const)(
    'handles %s exactly once',
    (choice) => {
      paste();
      choose(choice);
      choose(choice);
      if (choice === 'cancel') expect(editor.insert).not.toHaveBeenCalled();
      else
        expect(editor.insert).toHaveBeenCalledExactlyOnceWith(
          choice === 'original' ? 'synthetic' : '[SYNTHETIC_1]',
        );
    },
  );
  it('blocks a paste reentered during insertion', () => {
    vi.mocked(editor.insert).mockImplementation(() => {
      expect(paste().preventDefault).toHaveBeenCalledOnce();
      return true;
    });
    paste();
    choose('original');
    expect(engine.scan).toHaveBeenCalledOnce();
  });
  it('blocks reentrant pastes while a decision is pending', () => {
    paste();
    const second = paste();
    expect(second.preventDefault).toHaveBeenCalledOnce();
    expect(engine.scan).toHaveBeenCalledOnce();
    expect(showWarning).toHaveBeenCalledOnce();
  });
  it('accepts repeated pastes after cancellation', () => {
    paste();
    choose('cancel');
    paste();
    expect(engine.scan).toHaveBeenCalledTimes(2);
  });
  it.each(['truncated', 'scan', 'redact'])(
    'fails closed on %s without a preview',
    (failure) => {
      if (failure === 'truncated')
        vi.mocked(engine.scan).mockReturnValue({
          findings: [],
          truncated: true,
        });
      else
        vi.mocked(engine[failure as 'scan' | 'redact']).mockImplementation(
          () => {
            throw new Error('Do not expose synthetic payload');
          },
        );
      expect(paste().preventDefault).toHaveBeenCalledOnce();
      const warning = vi.mocked(showWarning).mock.calls[0]![0];
      expect(warning.preview).toBeUndefined();
      expect(JSON.stringify(warning)).not.toContain('Do not expose');
      choose('redacted');
      expect(editor.insert).not.toHaveBeenCalled();
      choose('original');
      expect(editor.insert).toHaveBeenCalledWith('synthetic');
    },
  );
  it.each([false, true])(
    'blocks unavailable clipboard data: %s',
    (available) => {
      expect(
        paste({ available, types: [] }).preventDefault,
      ).toHaveBeenCalledOnce();
      expect(engine.scan).not.toHaveBeenCalled();
      expect(vi.mocked(showWarning).mock.calls[0]![0].canInsert).toBe(false);
      choose('original');
      expect(editor.insert).not.toHaveBeenCalled();
    },
  );
  it('identifies unsupported editors without reading or inserting clipboard data', () => {
    vi.mocked(captureEditor).mockReturnValue('unsupported');
    expect(paste().preventDefault).toHaveBeenCalledOnce();
    expect(engine.scan).not.toHaveBeenCalled();
    expect(vi.mocked(showWarning).mock.calls[0]![0]).toMatchObject({
      canInsert: false,
    });
    choose('original');
    expect(editor.insert).not.toHaveBeenCalled();
  });
  it('blocks during composition and resumes after composition ends', () => {
    listeners.get('compositionstart')!(new Event('compositionstart'));
    expect(paste().preventDefault).toHaveBeenCalledOnce();
    expect(engine.scan).not.toHaveBeenCalled();
    choose('cancel');
    listeners.get('compositionend')!(new Event('compositionend'));
    paste();
    expect(engine.scan).toHaveBeenCalledOnce();
  });
  it('keeps paste cancelled if UI creation throws', () => {
    vi.mocked(showWarning).mockImplementation(() => {
      throw new Error('UI failure');
    });
    expect(paste().preventDefault).toHaveBeenCalledOnce();
    expect(editor.insert).not.toHaveBeenCalled();
  });
  it('drops pending decisions on disable, pagehide and dialog removal', () => {
    paste();
    controller.stop();
    choose('original');
    expect(editor.insert).not.toHaveBeenCalled();
    expect(listeners.has('paste')).toBe(false);
    controller = installPasteProtection(doc, engine, showWarning);
    paste();
    listeners.get('pagehide')!(new Event('pagehide'));
    choose('original');
    expect(editor.insert).not.toHaveBeenCalled();
    paste();
    Object.defineProperty(view.host, 'isConnected', { value: false });
    removed();
    choose('original');
    expect(editor.insert).not.toHaveBeenCalled();
  });
  it('reinstallation cancels a pending decision and replaces listeners', () => {
    paste();
    const oldChoice = choose;
    controller = installPasteProtection(doc, engine, showWarning);
    oldChoice('original');
    expect(editor.insert).not.toHaveBeenCalled();
    paste();
    expect(showWarning).toHaveBeenCalledTimes(2);
  });
  it.each([false, true])(
    'does not retry failed/stale insertion: %s',
    (throws) => {
      vi.mocked(editor.insert).mockImplementation(() => {
        if (throws) throw new Error('Synthetic payload');
        return false;
      });
      paste();
      choose('original');
      choose('original');
      expect(editor.insert).toHaveBeenCalledOnce();
      expect(view.failed).toHaveBeenCalledOnce();
      choose('cancel');
    },
  );
});
