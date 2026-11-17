import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';
const require = createRequire(
  new URL('../../apps/extension/package.json', import.meta.url),
);
const { createServer } = await import(
  pathToFileURL(require.resolve('vite')).href
);
const server = await createServer({
  root: fileURLToPath(new URL('../../', import.meta.url)),
  configFile: false,
  server: { host: '127.0.0.1', port: 4173, strictPort: true },
});
await server.listen();
globalThis.console.info(
  'Manual extension fixture: http://127.0.0.1:4173/tests/fixtures/paste.html?manual=1',
);
