import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  // Generated/vendor code (shadcn + AI Elements) intentionally violates some dev-only rules.
  {
    files: [
      'src/components/ui/**/*.{ts,tsx}',
      'src/components/ai-elements/**/*.{ts,tsx}',
    ],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'react-refresh/only-export-components': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/static-components': 'off',
    },
  },
  // Chat shell internals: allow component registries alongside components.
  {
    files: ['src/components/chat/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
