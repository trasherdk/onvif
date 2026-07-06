import { defineConfig } from 'vitest/config';

export default defineConfig({
	envDir: './test',
	test: {
		globals: true,
		include: ['test/**/*.js'],
		exclude: ['test/serverMockup.cjs', 'test/vitest.setup.js'],
		testTimeout: 10_000,
		hookTimeout: 10_000,
		fileParallelism: false,
		pool: 'forks',
		poolOptions: {
			forks: {
				singleFork: true,
			},
		},
		setupFiles: ['./test/vitest.setup.js'],
		coverage: {
			provider: 'v8',
			include: ['src/**/*.ts'],
			exclude: ['src/types.ts'],
			reporter: ['text', 'html', 'lcov'],
		},
	},
});
