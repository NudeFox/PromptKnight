import { browser } from 'wxt/browser';
import { installPasteProtection } from '../src/paste/controller';

export default defineUnlistedScript(() => {
  if (
    location.protocol !== 'https:' &&
    !(
      location.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
    )
  )
    return;
  const scope = globalThis as typeof globalThis & {
    __promptknightProtection?: { stop(): void };
  };
  scope.__promptknightProtection?.stop();
  const controller = installPasteProtection();
  const listener: Parameters<
    typeof browser.runtime.onMessage.addListener
  >[0] = (message: unknown, _sender, respond) => {
    if (!message || typeof message !== 'object' || !('type' in message)) return;
    if (message.type === 'PROMPTKNIGHT_STATUS') respond({ enabled: true });
    if (message.type === 'PROMPTKNIGHT_DISABLE') {
      stop();
      respond({ enabled: false });
    }
  };
  const stop = () => {
    window.removeEventListener('pagehide', stop);
    controller.stop();
    browser.runtime.onMessage.removeListener(listener);
    delete scope.__promptknightProtection;
  };
  window.addEventListener('pagehide', stop, { once: true });
  scope.__promptknightProtection = { stop };
  browser.runtime.onMessage.addListener(listener);
});
