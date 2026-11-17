import {
  createElement,
  useState,
} from '../../apps/extension/node_modules/react';
import { createRoot } from '../../apps/extension/node_modules/react-dom/client';
import { installPasteProtection } from '../../apps/extension/src/paste/controller';
import { scan, redact } from '../../packages/detection-engine/src';

// Test fixture only: expose dialog DOM to assertions; production uses a closed root.
const attach = Element.prototype.attachShadow;
Element.prototype.attachShadow = function (options) {
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
