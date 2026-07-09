import * as onvif from '../src/onvif.ts';

/**
 * Camera hostname for integration tests.
 * Uses CAMERA_HOST from .env (same as examples). When unset, tests use the mock server.
 * @returns {string | undefined}
 */
export function deviceHostname() {
	return process.env.CAMERA_HOST || undefined;
}

export const synthTest = !deviceHostname();

/** @type {typeof import('./serverMockup.js') | null} */
export const mockServer = synthTest ? await import('./serverMockup.js') : null;

export const camOptions = {
	hostname: deviceHostname() || 'localhost',
	username: process.env.USERNAME || 'admin',
	password: process.env.PASSWORD || '9999',
	port: process.env.PORT ? parseInt(process.env.PORT, 10) : 10101,
};

/**
 * @param {Partial<import('../src/onvif.ts').CamOptions>} [overrides]
 * @returns {Promise<import('../src/onvif.ts').Cam>}
 */
export function createCam(overrides = {}) {
	return new Promise((resolve, reject) => {
		const cam = new onvif.Cam({ ...camOptions, ...overrides }, (err) => {
			if (err) reject(err);
			else resolve(cam);
		});
	});
}

/**
 * Promisify a node-style callback invoked as fn(...args, cb).
 * @template T
 * @param {(...args: unknown[]) => void} fn
 * @param {...unknown} args
 * @returns {Promise<T>}
 */
export function invoke(fn, ...args) {
	return new Promise((resolve, reject) => {
		fn(...args, (err, ...results) => {
			if (err) reject(err);
			else resolve(results[0]);
		});
	});
}

/** @param {number} ms */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export { onvif };
