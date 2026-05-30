import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules', '.next'],
  },
  resolve: {
    alias: {
      // Mirror the tsconfig "@/*" -> "./*" path alias.
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
});
