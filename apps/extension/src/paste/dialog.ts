import type { Finding } from '@promptknight/detection-engine';
import styles from './dialog.css?inline';

export type Choice = 'redacted' | 'original' | 'cancel';
export interface Warning {
  message: string;
  findings: Finding[];
  preview?: string;
  canInsert: boolean;
}

/** Receives sanitized text only; original clipboard text never enters the dialog. */
export function showWarning(
  warning: Warning,
  choose: (choice: Choice) => void,
) {
  const host = document.createElement('promptknight-warning');
  const root = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = styles;
  const dialog = document.createElement('dialog');
  dialog.lang = 'en';
  dialog.setAttribute('aria-labelledby', 'pk-title');
  dialog.setAttribute('aria-describedby', 'pk-description');
  const title = document.createElement('h2');
  title.id = 'pk-title';
  title.textContent = 'PromptKnight paused this paste';
  const description = document.createElement('p');
  description.id = 'pk-description';
  description.textContent = warning.message;
  const list = document.createElement('ul');
  const groups = new Map<string, number>();
  for (const finding of warning.findings) {
    const key = `${finding.type.replaceAll('_', ' ')} · ${finding.severity} severity`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  for (const [label, count] of groups) {
    const item = document.createElement('li');
    item.textContent = `${label}: ${count}`;
    list.append(item);
  }
  dialog.append(title, description);
  if (groups.size) dialog.append(list);
  if (warning.preview !== undefined) {
    const label = document.createElement('h3');
    label.textContent = 'Redacted preview';
    const preview = document.createElement('pre');
    preview.textContent =
      warning.preview.slice(0, 4000) +
      (warning.preview.length > 4000 ? '\n… Preview shortened' : '');
    dialog.append(label, preview);
  }
  const error = document.createElement('p');
  error.setAttribute('role', 'alert');
  const actions = document.createElement('div');
  actions.className = 'actions';
  const abort = new AbortController();
  const buttons: HTMLButtonElement[] = [];
  for (const [choice, label] of [
    ['redacted', 'Paste redacted'],
    ['original', 'Paste original'],
    ['cancel', 'Cancel'],
  ] as const) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.disabled =
      choice !== 'cancel' &&
      (!warning.canInsert ||
        (choice === 'redacted' && warning.preview === undefined));
    button.autofocus = choice === 'cancel';
    button.addEventListener('click', () => choose(choice), {
      signal: abort.signal,
    });
    buttons.push(button);
    actions.append(button);
  }
  dialog.append(error, actions);
  // Native modal focus containment and Escape; any dismissal always cancels.
  dialog.addEventListener('cancel', () => choose('cancel'), {
    signal: abort.signal,
  });
  dialog.addEventListener('close', () => choose('cancel'), {
    signal: abort.signal,
  });
  root.append(style, dialog);
  document.documentElement.append(host);
  try {
    dialog.showModal();
  } catch {
    host.remove();
    abort.abort();
    throw new Error('Warning UI unavailable');
  }
  return {
    close() {
      abort.abort();
      dialog.close();
      host.remove();
    },
    failed() {
      error.textContent =
        'Insertion could not be completed. The editor may have changed or rejected the text. Cancel and check the editor before trying again.';
      for (const button of buttons)
        if (button.textContent !== 'Cancel') button.disabled = true;
      buttons.at(-1)?.focus();
    },
    host,
  };
}
