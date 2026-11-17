import {
  scan,
  redact,
  type DetectionEngine,
} from '@promptknight/detection-engine';
import { captureEditor, type EditorSnapshot } from './editor';
import { showWarning, type Choice, type Warning } from './dialog';

type WarningView = ReturnType<typeof showWarning>;
interface Pending {
  canInsert: boolean;
  original: string;
  redacted: string | undefined;
  editor: EditorSnapshot | null;
  view: WarningView | null;
  observer: MutationObserver | null;
}
const controllers = new WeakMap<Document, { stop(): void }>();

/** One listener per document; installing twice cancels and disposes the previous controller. */
export function installPasteProtection(
  doc: Document = document,
  engine: DetectionEngine = { scan, redact },
  openWarning: typeof showWarning = showWarning,
) {
  controllers.get(doc)?.stop();
  const abort = new AbortController();
  let pending: Pending | null = null;
  let composing = false;
  let inserting = false;
  const finish = () => {
    const current = pending;
    pending = null;
    if (!current) return;
    current.observer?.disconnect();
    try {
      current.view?.close();
    } catch {
      /* Keep cancellation best-effort. */
    }
    try {
      current.editor?.restore();
    } catch {
      /* A removed editor may no longer accept a range. */
    }
    current.original = '';
    current.redacted = undefined;
    current.editor = null;
    current.view = null;
  };
  const choose = (choice: Choice) => {
    if (!pending || inserting) return;
    if (choice === 'cancel') {
      finish();
      return;
    }
    const current = pending;
    const text = choice === 'original' ? current.original : current.redacted;
    if (!current.canInsert || text === undefined || !current.editor) return;
    // Close the modal before focusing the editor, since modal content makes it inert.
    current.observer?.disconnect();
    current.view?.close();
    inserting = true;
    let success = false;
    try {
      success = current.editor.insert(text);
    } catch {
      /* Fixed UI error only; never expose exception details or source text. */
    } finally {
      inserting = false;
    }
    if (success) {
      finish();
      return;
    }
    current.original = '';
    current.redacted = undefined;
    current.editor = null;
    current.canInsert = false;
    try {
      current.view = openWarning(
        {
          message:
            'The editor could not accept this paste. Check the editor before trying again.',
          findings: [],
          canInsert: false,
        },
        choose,
      );
      current.view.failed();
    } catch {
      finish();
    }
  };
  const onPaste = (event: ClipboardEvent) => {
    if (!event.isTrusted || event.defaultPrevented) return;
    if (pending || inserting) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const target = event.composedPath()[0];
    let editor: ReturnType<typeof captureEditor>;
    try {
      editor = captureEditor(target);
    } catch {
      editor = 'unsupported';
    }
    if (editor === null) return;
    let original = '';
    let hasOriginal = false;
    let redacted: string | undefined;
    let warning: Warning;
    try {
      if (composing || editor === 'unsupported') {
        warning = {
          message:
            'This editor or composition session is unsupported. Nothing was pasted. Cancel and use a supported editor.',
          findings: [],
          canInsert: false,
        };
      } else {
        if (
          !event.clipboardData ||
          !event.clipboardData.types.includes('text/plain')
        ) {
          warning = {
            message:
              'Plain-text clipboard data is unavailable. Nothing was pasted.',
            findings: [],
            canInsert: false,
          };
        } else {
          original = event.clipboardData.getData('text/plain');
          hasOriginal = true;
          const result = engine.scan(original);
          if (result.truncated)
            warning = {
              message:
                'This paste exceeds the scan limit. Protection could not scan it completely. Paste original only if you accept the risk.',
              findings: [],
              canInsert: true,
            };
          else if (result.findings.length === 0) return;
          else {
            redacted = engine.redact(original, result.findings);
            warning = {
              message: `${result.findings.length} potential sensitive value(s) found. Review the redacted text before choosing. Detection can miss other sensitive content.`,
              findings: result.findings,
              preview: redacted,
              canInsert: true,
            };
          }
        }
      }
    } catch {
      warning = {
        message:
          'Protection could not scan this paste. Paste original only if you accept the risk, or cancel.',
        findings: [],
        canInsert: editor !== 'unsupported' && hasOriginal,
      };
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    pending = {
      canInsert: warning.canInsert,
      original,
      redacted,
      editor: editor === 'unsupported' ? null : editor,
      view: null,
      observer: null,
    };
    try {
      pending.view = openWarning(warning, choose);
      // Host-page removal of the warning must cancel, never insert later.
      const observer = new MutationObserver(() => {
        if (pending?.view && !pending.view.host.isConnected) finish();
      });
      observer.observe(doc.documentElement, { childList: true });
      pending.observer = observer;
    } catch {
      finish(); /* Paste stays cancelled even if the dialog cannot open. */
    }
  };
  doc.defaultView?.addEventListener('paste', onPaste, {
    capture: true,
    signal: abort.signal,
  });
  doc.addEventListener(
    'compositionstart',
    () => {
      composing = true;
    },
    { signal: abort.signal },
  );
  doc.addEventListener(
    'compositionend',
    () => {
      composing = false;
    },
    { signal: abort.signal },
  );
  doc.defaultView?.addEventListener('pagehide', finish, {
    signal: abort.signal,
  });
  const controller = {
    stop() {
      abort.abort();
      finish();
      if (controllers.get(doc) === controller) controllers.delete(doc);
    },
  };
  controllers.set(doc, controller);
  return controller;
}
