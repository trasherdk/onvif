import { defineConfig } from 'eslint/config';
import globals from 'globals';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default defineConfig([
	...tseslint.configs.recommended,
	{
		...js.configs.recommended,
		files: ['test/**/*.js'],
		languageOptions: {
			globals: {
				...globals.node,
				...globals.mocha,
			},
			ecmaVersion: 2022,
			sourceType: 'module',
		},
		rules: {
			'no-console': 0,
			'no-param-reassign': 0,
			'no-unused-vars': ['error', {
				argsIgnorePattern: '^_',
				caughtErrorsIgnorePattern: '^_',
			}],
			'object-curly-newline': ['error', {
				ObjectPattern: { multiline: true },
			}],
			strict: 0,
			curly: [2, 'all'],
			'keyword-spacing': [2, {}],
			'space-before-function-paren': [2, 'never'],
			'no-spaced-func': 2,
			'space-infix-ops': 2,
			'space-unary-ops': [2, { words: false, nonwords: false }],
			'no-with': 2,
			'brace-style': [2, '1tbs', { allowSingleLine: true }],
			'key-spacing': [2, { beforeColon: false, afterColon: true }],
			indent: [2, 'tab', { SwitchCase: 1 }],
			'no-mixed-spaces-and-tabs': 2,
			camelcase: [2, { properties: 'never' }],
			semi: 'error',
		},
	},
	{
		files: ['src/**/*.ts'],
		languageOptions: {
			globals: {
				...globals.node,
			},
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			'no-console': 0,
			'no-param-reassign': 0,
			'@typescript-eslint/no-explicit-any': 0,
			'@typescript-eslint/no-this-alias': 0,
			'@typescript-eslint/no-require-imports': 0,
			'prefer-const': 0,
			'@typescript-eslint/no-unused-vars': ['error', {
				argsIgnorePattern: '^_',
				caughtErrorsIgnorePattern: '^_',
			}],
			curly: [2, 'all'],
			'keyword-spacing': [2, {}],
			'space-before-function-paren': [2, 'never'],
			'space-infix-ops': 2,
			'brace-style': [2, '1tbs', { allowSingleLine: true }],
			'key-spacing': [2, { beforeColon: false, afterColon: true }],
			indent: [2, 'tab', { SwitchCase: 1 }],
			'no-mixed-spaces-and-tabs': 2,
			semi: 'error',
		},
	},
]);
