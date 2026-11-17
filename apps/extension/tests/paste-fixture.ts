import { createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { installPasteProtection } from '../src/paste/controller';
import { scan, redact } from '@promptknight/detection-engine';

// Set exact text nodes explicitly: HTML formatting adds whitespace around div contents.
for (const id of ['editable', 'complex']) {
  document.getElementById(id)!.textContent = 'before after';
}

// Test fixture only: expose dialog DOM to assertions; production uses a closed root.
const attach = Element.prototype.attachShadow;
Element.prototype.attachShadow = function (
  this: Element,
  options: ShadowRootInit,
) {
  return attach.call(this, { ...options, mode: 'open' });
};
function ControlledInput() {
  const [value, setValue] = useState('before after');
  return createElement(
    'div',
    null,
    createElement('label', { htmlFor: 'react' }, 'React-controlled input'),
    createElement('input', {
      id: 'react',
      value,
      onChange: (event: { target: { value: string } }) =>
        setValue(event.target.value),
    }),
    createElement('output', { id: 'react-value' }, value),
  );
}
createRoot(document.getElementById('react-root')!).render(
  createElement(ControlledInput),
);
let controller: ReturnType<typeof installPasteProtection> | undefined;
let failure = false;
const fixture = {
  enable() {
    controller = installPasteProtection(document, {
      scan(text) {
        if (failure) throw new Error('Synthetic failure');
        return scan(text);
      },
      redact,
    });
  },
  disable() {
    controller?.stop();
  },
  fail(value: boolean) {
    failure = value;
  },
};
Object.assign(window, { fixture });
if (!new URLSearchParams(location.search).has('manual')) fixture.enable();
