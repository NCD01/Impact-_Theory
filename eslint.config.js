/**
 * eslint.config.js
 *
 * OWNS: lint rules for the whole repository.
 *
 * MUST NOT OWN: formatting opinions that fight the code style already in use, and
 * anything about what the game does.
 *
 * The archived Unity C# under _source/ and the generated models under public/ are
 * excluded. Nothing in either is built, run or maintained by this project.
 */

import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      '_source/**',
      'Assets/**',
      'Reference/**',
      'dist/**',
      'public/models/**',
      'node_modules/**',
      '.agent_temp/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // An unused variable is usually a half finished edit, which in an unattended
      // session is exactly the thing worth catching. Underscore prefix opts out.
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
