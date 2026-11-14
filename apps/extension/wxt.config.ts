import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifestVersion: 3,
  manifest: {
    name: 'PromptKnight',
    description:
      'PromptKnight development preview. Paste protection is not implemented yet.',
  },
});
