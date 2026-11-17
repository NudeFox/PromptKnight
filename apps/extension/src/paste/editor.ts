export interface EditorSnapshot {
  restore(): void;
  insert(text: string): boolean;
}

const complexEditors =
  '.ProseMirror, .ql-editor, [data-slate-editor], [data-lexical-editor]';

/** Returns null for non-editors, and 'unsupported' for an editable we cannot safely insert into. */
export function captureEditor(
  target: EventTarget | undefined,
): EditorSnapshot | 'unsupported' | null {
  if (!(target instanceof HTMLElement)) return null;
  if (target.closest('[aria-disabled="true"], [aria-readonly="true"]'))
    return null;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement
  ) {
    if (target.matches(':disabled') || target.readOnly) return null;
    if (
      target instanceof HTMLInputElement &&
      !['text', 'search', 'url', 'tel'].includes(target.type)
    )
      return null;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const direction = target.selectionDirection ?? 'none';
    if (start === null || end === null) return 'unsupported';
    const original = target.value;
    const inputType = target instanceof HTMLInputElement ? target.type : null;
    const valid = () =>
      target.isConnected &&
      !target.matches(':disabled') &&
      !target.readOnly &&
      target.value === original &&
      (inputType === null ||
        (target instanceof HTMLInputElement && target.type === inputType));
    const restore = () => {
      if (!valid()) return;
      target.focus({ preventScroll: true });
      target.setSelectionRange(start, end, direction);
    };
    return {
      restore,
      insert(text) {
        if (
          !valid() ||
          (target.maxLength >= 0 &&
            original.length - (end - start) + text.length > target.maxLength)
        )
          return false;
        restore();
        if (
          !target.dispatchEvent(
            new InputEvent('beforeinput', {
              bubbles: true,
              composed: true,
              cancelable: true,
              inputType: 'insertFromPaste',
              data: text,
            }),
          )
        )
          return false;
        if (
          !valid() ||
          (target.getRootNode() instanceof ShadowRoot
            ? (target.getRootNode() as ShadowRoot).activeElement
            : target.ownerDocument.activeElement) !== target ||
          target.selectionStart !== start ||
          target.selectionEnd !== end
        )
          return false;
        // Chromium's editing command preserves undo and notifies React-controlled inputs.
        let inputFired = false;
        const onInput = () => {
          inputFired = true;
        };
        target.addEventListener('input', onInput);
        try {
          target.ownerDocument.execCommand?.('insertText', false, text);
        } finally {
          target.removeEventListener('input', onInput);
        }
        if (!inputFired && target.value === original) {
          const prototype =
            target instanceof HTMLInputElement
              ? HTMLInputElement.prototype
              : HTMLTextAreaElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(
            prototype,
            'value',
          )?.set;
          if (!setter) return false;
          setter.call(
            target,
            original.slice(0, start) + text + original.slice(end),
          );
          target.setSelectionRange(start + text.length, start + text.length);
        }
        if (!inputFired)
          target.dispatchEvent(
            new InputEvent('input', {
              bubbles: true,
              composed: true,
              inputType: 'insertFromPaste',
              data: text,
            }),
          );
        return true;
      },
    };
  }
  if (!target.isContentEditable)
    return target.closest('[role="textbox"]') ? 'unsupported' : null;
  let editor = target;
  while (editor.parentElement?.isContentEditable) editor = editor.parentElement;
  if (
    editor.closest(complexEditors) ||
    editor.querySelector('[contenteditable], input, textarea') ||
    editor.getRootNode() !== document
  )
    return 'unsupported';
  const selection = editor.ownerDocument.getSelection();
  if (!selection?.rangeCount) return 'unsupported';
  const range = selection.getRangeAt(0).cloneRange();
  const anchor = selection.anchorNode;
  const anchorOffset = selection.anchorOffset;
  const focus = selection.focusNode;
  const focusOffset = selection.focusOffset;
  if (!anchor || !focus) return 'unsupported';
  if (
    !editor.contains(range.startContainer) ||
    !editor.contains(range.endContainer)
  )
    return 'unsupported';
  // The snapshot is transient and used only to reject stale insertion targets.
  const original = editor.innerHTML;
  const valid = () =>
    editor.isConnected &&
    editor.isContentEditable &&
    editor.innerHTML === original &&
    editor.contains(anchor) &&
    editor.contains(focus);
  const restore = () => {
    if (!valid()) return;
    editor.focus({ preventScroll: true });
    selection.setBaseAndExtent(anchor, anchorOffset, focus, focusOffset);
  };
  return {
    restore,
    insert(text) {
      if (!valid()) return false;
      restore();
      if (
        !editor.dispatchEvent(
          new InputEvent('beforeinput', {
            bubbles: true,
            composed: true,
            cancelable: true,
            inputType: 'insertFromPaste',
            data: text,
          }),
        )
      )
        return false;
      if (
        !valid() ||
        editor.ownerDocument.activeElement !== editor ||
        !selection.rangeCount ||
        !selection
          .getRangeAt(0)
          .isPointInRange(range.startContainer, range.startOffset) ||
        selection
          .getRangeAt(0)
          .compareBoundaryPoints(Range.START_TO_START, range) !== 0 ||
        selection
          .getRangeAt(0)
          .compareBoundaryPoints(Range.END_TO_END, range) !== 0
      )
        return false;
      let inputFired = false;
      const onInput = () => {
        inputFired = true;
      };
      editor.addEventListener('input', onInput);
      let inserted: boolean;
      try {
        inserted =
          editor.ownerDocument.execCommand?.('insertText', false, text) ??
          false;
      } finally {
        editor.removeEventListener('input', onInput);
      }
      if (!inserted && !inputFired && editor.innerHTML === original) {
        range.deleteContents();
        const node = document.createTextNode(text);
        range.insertNode(node);
        range.setStartAfter(node);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      if (!inputFired)
        editor.dispatchEvent(
          new InputEvent('input', {
            bubbles: true,
            composed: true,
            inputType: 'insertFromPaste',
            data: text,
          }),
        );
      return true;
    },
  };
}
