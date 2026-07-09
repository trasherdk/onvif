import { defineConfig } from 'vitest/config';

export default defineConfig({
	envDir: './test',
	test: {
		globals: false,
		include: ['test/**/*.js'],
		exclude: ['test/serverMockup.js', 'test/vitest.setup.js', 'test/helpers.js'],
		testTimeout: 10_000,
		hookTimeout: 10_000,
		// Serial run + shared process so the HTTP mock on :10101 stays up for all files.
		fileParallelism: false,
		maxWorkers: 1,
		isolate: false,
		setupFiles: ['./test/vitest.setup.js'],
		coverage: {
			provider: 'v8',
			include: ['src/**/*.ts'],
			exclude: ['src/types.ts'],
			reporter: ['text', 'html', 'lcov'],
		},
	},
});
