import { createRequire } from 'module';
import {
	afterAll,
	beforeAll,
	describe as vitestDescribe,
	it as vitestIt,
} from 'vitest';

const require = createRequire(import.meta.url);

function wrapDoneFn(fn) {
	if (fn.length === 0) {
		return fn;
	}
	return () =>
		new Promise((resolve, reject) => {
			const done = (err) => {
				if (err) {
					reject(err instanceof Error ? err : new Error(String(err)));
				} else {
					resolve();
				}
			};
			try {
				const result = fn(done);
				if (result && typeof result.then === 'function') {
					result.then(resolve, reject);
				}
			} catch (err) {
				reject(err);
			}
		});
}

function wrapRunner(runner) {
	const wrapped = (name, arg2, arg3) => {
		if (typeof arg2 === 'function') {
			return runner(name, wrapDoneFn(arg2));
		}
		return runner(name, arg2, wrapDoneFn(arg3));
	};
	wrapped.only = (name, arg2, arg3) => {
		if (typeof arg2 === 'function') {
			return runner.only(name, wrapDoneFn(arg2));
		}
		return runner.only(name, arg2, wrapDoneFn(arg3));
	};
	wrapped.skip = (name, arg2, arg3) => {
		if (typeof arg2 === 'function') {
			return runner.skip(name, wrapDoneFn(arg2));
		}
		return runner.skip(name, arg2, wrapDoneFn(arg3));
	};
	wrapped.todo = runner.todo?.bind(runner);
	wrapped.concurrent = runner.concurrent?.bind(runner);
	wrapped.sequential = runner.sequential?.bind(runner);
	wrapped.each = runner.each?.bind(runner);
	return wrapped;
}

globalThis.describe = vitestDescribe;
globalThis.it = wrapRunner(vitestIt);
globalThis.before = (fn) => beforeAll(wrapDoneFn(fn));
globalThis.after = (fn) => afterAll(wrapDoneFn(fn));

// Mock-server tests must not pick up camera credentials from the project .env.
delete process.env.HOSTNAME;

if (!process.env.HOSTNAME) {
	require('./serverMockup.cjs');
}
