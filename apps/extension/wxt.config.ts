import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifestVersion: 3,
  manifest: {
    minimum_chrome_version: '123',
    name: 'PromptKnight',
    permissions: ['activeTab', 'scripting'],
    description:
      'Local paste checks for potential secrets on pages you enable. Development preview.',
  },
});
