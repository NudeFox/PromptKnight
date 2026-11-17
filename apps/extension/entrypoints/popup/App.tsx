import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { PRODUCT_NAME } from '@promptknight/shared';

export default function App() {
  const [tabId, setTabId] = useState<number>();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    async function load() {
      try {
        const [tab] = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (!live) return;
        setTabId(tab?.id);
        if (tab?.id === undefined) return;
        try {
          const response = await browser.tabs.sendMessage(
            tab.id,
            { type: 'PROMPTKNIGHT_STATUS' },
            { frameId: 0 },
          );
          if (live) setEnabled(response?.enabled === true);
        } catch {
          /* No listener on a page that has not been enabled. */
        }
      } catch {
        if (live) setError('Unable to access the current tab.');
      } finally {
        if (live) setBusy(false);
      }
    }
    void load();
    return () => {
      live = false;
    };
  }, []);
  async function toggle() {
    if (tabId === undefined) return;
    setBusy(true);
    setError('');
    try {
      if (enabled) {
        await browser.tabs.sendMessage(
          tabId,
          { type: 'PROMPTKNIGHT_DISABLE' },
          { frameId: 0 },
        );
        setEnabled(false);
      } else {
        // Clicking the toolbar action grants activeTab before this popup is opened.
        await browser.scripting.executeScript({
          target: { tabId },
          files: ['/protection.js'],
        });
        const response = await browser.tabs.sendMessage(
          tabId,
          { type: 'PROMPTKNIGHT_STATUS' },
          { frameId: 0 },
        );
        if (response?.enabled !== true) throw new Error('Unavailable');
        setEnabled(true);
      }
    } catch {
      setEnabled(false);
      setError(
        'Protection could not be enabled or confirmed. Use an HTTPS page or localhost, reopen this popup from the toolbar, and try again. Browser pages and the Chrome Web Store are restricted.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main>
      <span className="badge">Development preview</span>
      <h1>{PRODUCT_NAME}</h1>
      <p className="tagline">Local-first protection for sensitive text</p>
      <p className="notice" role="status">
        {busy
          ? 'Checking this page…'
          : enabled
            ? 'Paste checks enabled on this page.'
            : 'Paste checks are off on this page.'}
      </p>
      <button
        type="button"
        disabled={busy || tabId === undefined}
        onClick={() => {
          void toggle();
        }}
      >
        {enabled ? 'Disable on this page' : 'Enable on this page'}
      </button>
      {error && <p role="alert">{error}</p>}
      <p>
        Enable again after a reload or navigation. Checks cover text inputs,
        textareas and basic contenteditable in the main page only. Complex
        editors and frames are unsupported.
      </p>
    </main>
  );
}
