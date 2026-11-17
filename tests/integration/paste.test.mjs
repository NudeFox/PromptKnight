import assert from 'node:assert/strict';
import process from 'node:process';
import { setTimeout, clearTimeout } from 'node:timers';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';
import { after, before, test } from 'node:test';

// Small CDP harness: no extension test-only permissions or extra runtime dependencies.
const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(
  new URL('../../apps/extension/package.json', import.meta.url),
);
const { createServer } = await import(
  pathToFileURL(require.resolve('vite')).href
);
let server, chrome, socket, profile;
let sequence = 0;
let navigation = 0;
const waiting = new Map();
function send(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      waiting.delete(id);
      reject(new Error(`CDP timeout: ${method}`));
    }, 10000);
    waiting.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error('Fixture evaluation failed');
  return result.result.value;
}
async function until(expression) {
  for (let i = 0; i < 100; i++) {
    try {
      if (await evaluate(expression)) return;
    } catch {
      /* Navigation can replace the execution context. */
    }
    await delay(30);
  }
  throw new Error(`Fixture condition timed out: ${expression}`);
}
const dialog = `document.querySelector('promptknight-warning')?.shadowRoot.querySelector('dialog')`;
async function focus(id, start = 7, end = 7) {
  await evaluate(`(() => {
    const el = document.getElementById(${JSON.stringify(id)});
    el.focus();
    if ('setSelectionRange' in el) el.setSelectionRange(${start}, ${end});
    else { const r = document.createRange(); r.setStart(el.firstChild, ${start}); r.setEnd(el.firstChild, ${end}); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  })()`);
}
async function key(key, code, modifiers = 0) {
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key,
    code,
    modifiers,
    windowsVirtualKeyCode: { KeyV: 86, KeyZ: 90, Tab: 9, Escape: 27 }[code],
    commands:
      modifiers && key === 'v'
        ? ['paste']
        : modifiers && key === 'z'
          ? ['undo']
          : [],
  });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers });
}
async function paste(text) {
  await evaluate(`navigator.clipboard.writeText(${JSON.stringify(text)})`);
  await key('v', 'KeyV', process.platform === 'darwin' ? 4 : 2);
}
async function clickChoice(label) {
  const point = await evaluate(`(() => {
    const b = Array.from(${dialog}.querySelectorAll('button')).find(b => b.textContent === ${JSON.stringify(label)});
    const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    button: 'left',
    clickCount: 1,
    ...point,
  });
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    button: 'left',
    clickCount: 1,
    ...point,
  });
}
async function choose(label) {
  await clickChoice(label);
  await until(`!document.querySelector('promptknight-warning')`);
}

async function reset() {
  const url = `${server.resolvedUrls.local[0]}tests/fixtures/paste.html?run=${++navigation}`;
  await send('Page.navigate', { url });
  await until(
    `location.href === ${JSON.stringify(url)} && document.readyState === 'complete' && Boolean(window.fixture && document.getElementById('react'))`,
  );
  await send('Page.bringToFront');
}

const synthetic = `ghp_${'Ab12'.repeat(9)}`;
before(
  async () => {
    server = await createServer({
      root,
      configFile: false,
      server: { host: '127.0.0.1', port: 0 },
      logLevel: 'error',
    });
    await server.listen();
    profile = await mkdtemp(join(tmpdir(), 'promptknight-paste-'));
    const candidates =
      process.platform === 'darwin'
        ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
        : [
            '/usr/bin/google-chrome',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
          ];
    const executable = process.env.CHROME_PATH || candidates.find(existsSync);
    if (!executable)
      throw new Error('Set CHROME_PATH to a Chromium executable');
    chrome = spawn(
      executable,
      [
        '--headless=new',
        '--no-sandbox',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--remote-debugging-port=0',
        `--user-data-dir=${profile}`,
        'about:blank',
      ],
      { stdio: 'ignore' },
    );
    chrome.on('error', () => {});
    let port;
    for (let i = 0; i < 150; i++) {
      try {
        port = Number(
          (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split(
            '\n',
          )[0],
        );
        break;
      } catch {
        await delay(100);
      }
    }
    if (!port) throw new Error('Chromium could not start in this environment');
    const targets = await (
      await globalThis.fetch(`http://127.0.0.1:${port}/json/list`)
    ).json();
    const target = targets.find((t) => t.type === 'page');
    socket = new globalThis.WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data);
      const pending = waiting.get(message.id);
      if (!pending) return;
      waiting.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
    await send('Page.enable');
    await send('Browser.grantPermissions', {
      origin: server.resolvedUrls.local[0].replace(/\/$/, ''),
      permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
    });
  },
  { timeout: 25000 },
);
after(async () => {
  socket?.close();
  chrome?.kill('SIGKILL');
  for (const pending of waiting.values()) {
    clearTimeout(pending.timer);
    pending.reject(new Error('Browser closed'));
  }
  waiting.clear();
  await server?.close();
  if (profile)
    await rm(profile, { recursive: true, force: true, maxRetries: 3 });
});

for (const id of ['textarea', 'text', 'react', 'editable']) {
  test(`${id}: trusted clean paste uses native insertion`, async () => {
    await reset();
    await focus(id);
    await paste('clean');
    await until(
      `(document.getElementById('${id}').value ?? document.getElementById('${id}').textContent) === 'before cleanafter'`,
    );
    assert.equal(await evaluate(`Boolean(${dialog})`), false);
    if (id === 'react')
      assert.equal(
        await evaluate(`document.getElementById('react-value').textContent`),
        'before cleanafter',
      );
  });
  test(`${id}: detected paste blocks, redacts selection and supports undo`, async () => {
    await reset();
    await focus(id, 0, 6);
    await paste(synthetic);
    await until(`Boolean(${dialog}?.open)`);
    assert.equal(
      await evaluate(
        `document.getElementById('${id}').value ?? document.getElementById('${id}').textContent`,
      ),
      'before after',
    );
    assert.equal(
      await evaluate(
        `${dialog}.textContent.includes(${JSON.stringify(synthetic)})`,
      ),
      false,
    );
    await choose('Paste redacted');
    await until(
      `(document.getElementById('${id}').value ?? document.getElementById('${id}').textContent) === '[GITHUB_TOKEN_1] after'`,
    );
    if (id === 'react')
      assert.equal(
        await evaluate(`document.getElementById('react-value').textContent`),
        '[GITHUB_TOKEN_1] after',
      );
    await key('z', 'KeyZ', process.platform === 'darwin' ? 4 : 2);
    await until(
      `(document.getElementById('${id}').value ?? document.getElementById('${id}').textContent) === 'before after'`,
    );
  });
  test(`${id}: cancel and Escape preserve content, selection and focus`, async () => {
    await reset();
    await focus(id, 1, 4);
    await paste(synthetic);
    await until(`Boolean(${dialog}?.open)`);
    await choose('Cancel');
    assert.equal(await evaluate(`document.activeElement.id`), id);
    assert.equal(
      await evaluate(
        `document.getElementById('${id}').value ?? document.getElementById('${id}').textContent`,
      ),
      'before after',
    );
    assert.equal(
      await evaluate(
        `'selectionStart' in document.getElementById('${id}') ? document.getElementById('${id}').selectionStart : getSelection().getRangeAt(0).startOffset`,
      ),
      1,
    );
    await paste(synthetic);
    await until(`Boolean(${dialog}?.open)`);
    await key('Escape', 'Escape');
    await until(`!document.querySelector('promptknight-warning')`);
    assert.equal(await evaluate(`document.activeElement.id`), id);
  });
}
test('Original requires an explicit choice', async () => {
  await reset();
  await focus('textarea');
  await paste(synthetic);
  await until(`Boolean(${dialog}?.open)`);
  await choose('Paste original');
  assert.equal(
    await evaluate(`document.getElementById('textarea').value`),
    `before ${synthetic}after`,
  );
});
test('failure and oversized input offer Original/Cancel without a preview', async () => {
  for (const failed of [false, true]) {
    await reset();
    await evaluate(`fixture.fail(${failed})`);
    await focus('textarea');
    await paste(failed ? synthetic : 'x'.repeat(100001));
    await until(`Boolean(${dialog}?.open)`);
    assert.equal(
      await evaluate(`${dialog}.querySelector('pre') === null`),
      true,
    );
    assert.equal(
      await evaluate(`${dialog}.querySelector('button').disabled`),
      true,
    );
    await choose('Cancel');
    assert.equal(
      await evaluate(`document.getElementById('textarea').value`),
      'before after',
    );
  }
});
test('duplicate enable, disable and pending cancellation clean up', async () => {
  await reset();
  await evaluate('fixture.enable(); fixture.enable()');
  await focus('textarea');
  await paste(synthetic);
  await until(`Boolean(${dialog}?.open)`);
  assert.equal(
    await evaluate(`document.querySelectorAll('promptknight-warning').length`),
    1,
  );
  await evaluate('fixture.disable()');
  await until(`!document.querySelector('promptknight-warning')`);
  await focus('textarea');
  await paste(synthetic);
  assert.equal(
    await evaluate(`document.getElementById('textarea').value`),
    `before ${synthetic}after`,
  );
  await evaluate('fixture.enable()');
  await paste(synthetic);
  await until(`Boolean(${dialog}?.open)`);
  await choose('Cancel');
});
test('unsupported editor is blocked and identified; password is excluded', async () => {
  await reset();
  await focus('complex');
  await paste(synthetic);
  await until(`Boolean(${dialog}?.open)`);
  assert.equal(
    await evaluate(`${dialog}.textContent.includes('unsupported')`),
    true,
  );
  assert.equal(
    await evaluate(`${dialog}.querySelectorAll('button')[1].disabled`),
    true,
  );
  await choose('Cancel');
  await focus('password', 0, 0);
  await paste(synthetic);
  assert.equal(await evaluate(`Boolean(${dialog})`), false);
  assert.equal(
    await evaluate(`document.getElementById('password').value`),
    synthetic,
  );
});
test('changed or detached target never receives a pending insertion', async () => {
  for (const mutation of [
    `document.getElementById('textarea').value = 'changed'`,
    `document.getElementById('textarea').remove()`,
  ]) {
    await reset();
    await focus('textarea');
    await paste(synthetic);
    await until(`Boolean(${dialog}?.open)`);
    await evaluate(mutation);
    await clickChoice('Paste original');
    await until(`${dialog}?.textContent.includes('could not')`);
    assert.equal(
      await evaluate(
        `document.getElementById('textarea')?.value.includes(${JSON.stringify(synthetic)}) ?? false`,
      ),
      false,
    );
    await choose('Cancel');
  }
});
test('untrusted events ignored and native dialog contains keyboard focus', async () => {
  await reset();
  await focus('textarea');
  assert.equal(
    await evaluate(
      `document.getElementById('textarea').dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true }))`,
    ),
    true,
  );
  await paste(synthetic);
  await until(`Boolean(${dialog}?.open)`);
  for (let i = 0; i < 6; i++) {
    await key('Tab', 'Tab');
    assert.equal(
      await evaluate(
        `document.activeElement.tagName === 'PROMPTKNIGHT-WARNING' || document.activeElement === document.body`,
      ),
      true,
    );
  }
  await choose('Cancel');
});

test('dialog removal cancels and a new paste requires a fresh choice', async () => {
  await reset();
  await focus('textarea');
  await paste(synthetic);
  await until(`Boolean(${dialog}?.open)`);
  await evaluate(`document.querySelector('promptknight-warning').remove()`);
  await focus('textarea');
  await paste(synthetic);
  await until(`Boolean(${dialog}?.open)`);
  await choose('Cancel');
  assert.equal(
    await evaluate(`document.getElementById('textarea').value`),
    'before after',
  );
});
test('composition and missing plain text are explicit cancel-only cases', async () => {
  await reset();
  await focus('textarea');
  await evaluate(
    `document.getElementById('textarea').dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))`,
  );
  await paste(synthetic);
  await until(`Boolean(${dialog}?.open)`);
  assert.equal(
    await evaluate(`${dialog}.querySelectorAll('button')[1].disabled`),
    true,
  );
  await choose('Cancel');
});
test('preview is plain text and bounded without truncating the chosen sanitized paste', async () => {
  await reset();
  await focus('textarea');
  await paste(
    'API_KEY=synthetic-demo-value\n' +
      '<img src=x onerror=alert(1)>'.repeat(200),
  );
  await until(`Boolean(${dialog}?.open)`);
  assert.equal(
    await evaluate(
      `${dialog}.querySelector('pre').querySelector('img') === null`,
    ),
    true,
  );
  assert.equal(
    await evaluate(
      `${dialog}.querySelector('pre').textContent.includes('Preview shortened')`,
    ),
    true,
  );
  await choose('Paste redacted');
  assert.equal(
    await evaluate(
      `document.getElementById('textarea').value.includes('[ENV_SECRET_1]')`,
    ),
    true,
  );
  assert.equal(
    await evaluate(`document.getElementById('textarea').value.length > 4000`),
    true,
  );
});
test('page beforeinput cancellation is honored without inserting', async () => {
  await reset();
  await focus('textarea');
  await paste(synthetic);
  await until(`Boolean(${dialog}?.open)`);
  await evaluate(
    `document.getElementById('textarea').addEventListener('beforeinput', e => e.preventDefault(), { once: true })`,
  );
  await clickChoice('Paste original');
  await until(`${dialog}?.textContent.includes('could not')`);
  assert.equal(
    await evaluate(`document.getElementById('textarea').value`),
    'before after',
  );
  await choose('Cancel');
});
