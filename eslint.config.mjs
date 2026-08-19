import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
export default tseslint.config(js.configs.recommended, ...tseslint.configs.recommendedTypeChecked, prettier, { languageOptions: { globals: { ...globals.node, ...globals.jest }, parserOptions: { project: './tsconfig.json', tsconfigRootDir: import.meta.dirname } }, rules: { '@typescript-eslint/no-floating-promises': 'error', '@typescript-eslint/no-explicit-any': 'off' } }, { ignores: ['dist/**', 'node_modules/**', '.opencode/**', '.commandcode/**'] });
