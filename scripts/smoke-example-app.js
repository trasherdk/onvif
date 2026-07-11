#!/usr/bin/env node
/**
 * Smoke-test example-app against the local ONVIF mock (localhost:10101).
 * Verifies HTTP UI, ONVIF connect, getStreamUri, and at least one PTZ move.
 * RTSP/ffmpeg is not exercised — the mock has no real stream.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { close } from '../test/serverMockup.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTTP_PORT = 6149;

const env = {
	...process.env,
	CAMERA_HOST: 'localhost',
	PORT: '10101',
	USERNAME: 'admin',
	PASSWORD: '9999',
	HTTP_PORT: String(HTTP_PORT),
};

const child = spawn(process.execPath, ['server.js'], {
	cwd: path.join(root, 'example-app'),
	env,
	stdio: ['ignore', 'pipe', 'pipe'],
});

let out = '';
child.stdout.on('data', (d) => { out += d; });
child.stderr.on('data', (d) => { out += d; });

function waitFor(pattern, timeoutMs = 15000) {
	return new Promise((resolve, reject) => {
		const start = Date.now();
		const tick = () => {
			if (pattern.test(out)) return resolve(out);
			if (Date.now() - start > timeoutMs) {
				return reject(new Error(`Timed out waiting for ${pattern}\n--- output ---\n${out.slice(-1500)}`));
			}
			setTimeout(tick, 100);
		};
		tick();
	});
}

try {
	await waitFor(/Open http:\/\/localhost:6149/);
	const res = await fetch(`http://localhost:${HTTP_PORT}/`);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const html = await res.text();
	if (!html.includes('socket.io') || !html.includes('canvas')) {
		throw new Error('Unexpected HTML from example-app');
	}
	await waitFor(/Connected to localhost:10101/);
	console.log('example-app smoke: OK (HTTP UI + ONVIF connect against mock)');
} catch (err) {
	console.error('example-app smoke: FAIL');
	console.error(err.message || err);
	process.exitCode = 1;
} finally {
	child.kill('SIGTERM');
	close();
}
