#!/usr/bin/env node
/**
 * Smoke-test examples against the local mock server (localhost:10101).
 * Usage: node scripts/smoke-examples.js
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { close } from '../test/serverMockup.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const baseEnv = {
	...process.env,
	CAMERA_HOST: 'localhost',
	PORT: '10101',
	USERNAME: 'admin',
	PASSWORD: '9999',
	DISCOVERY_TIMEOUT: '2000',
	DISCOVERY_SUBNET_SCAN: '0',
	DISCOVERY_CONNECT: '0',
	SCAN_RANGE_START: '127.0.0.1',
	SCAN_RANGE_END: '127.0.0.1',
	SCAN_PORTS: '10101',
	SCAN_TIMEOUT: '3000',
	SCAN_INCLUDE_GATEWAY: '1',
};

const cases = [
	{ file: 'example.js', timeout: 12000, expect: /CONNECTED|pan right|pan left/ },
	{ file: 'example2.js', timeout: 15000, expect: /Host:|CONNECTED|Connection Failed/ },
	{ file: 'example3.js', timeout: 5000, expect: /Connected|Connection|Error|stream/i },
	{ file: 'example4.js', timeout: 12000, expect: /device|Discovered|probe|ONVIF/i },
	{ file: 'example6.js', timeout: 8000, expect: /Event|PullPoint|Subscribe|CONNECTED|connect/i },
	{ file: 'example8.js', timeout: 15000, expect: /OSD|Connected|connect|Error/i },
	{ file: 'example9.js', timeout: 15000, expect: /Recording|Replay|connect|Error|Connecting/i },
	{ file: 'example7.js', timeout: 20000, expect: /FOUND ONVIF|Found \d+ ONVIF/ },
];

function runExample(name, timeoutMs, expectRe) {
	return new Promise((resolve) => {
		const child = spawn(process.execPath, [path.join(root, 'examples', name)], {
			cwd: root,
			env: baseEnv,
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		let out = '';
		child.stdout.on('data', (d) => { out += d; });
		child.stderr.on('data', (d) => { out += d; });
		const timer = setTimeout(() => {
			child.kill('SIGTERM');
		}, timeoutMs);
		child.on('close', (code) => {
			clearTimeout(timer);
			const ok = expectRe.test(out) && code !== 1;
			resolve({ name, ok, code, out: out.slice(-800) });
		});
	});
}

console.log('Mock server on localhost:10101 — smoke-testing examples...\n');

const results = [];
for (const c of cases) {
	process.stdout.write(`  ${c.file} ... `);
	const r = await runExample(c.file, c.timeout, c.expect);
	results.push(r);
	console.log(r.ok ? 'OK' : `FAIL (exit ${r.code})`);
	if (!r.ok) {
		console.log('    --- tail output ---');
		console.log(r.out.split('\n').map((l) => '    ' + l).join('\n'));
	}
}

// example5 requires a SOCKS proxy at PROXY_URI — expect connection failure, not a crash
process.stdout.write('  example5.js ... ');
const r5 = await runExample('example5.js', 5000, /Connection Failed|CONNECTED|ECONNREFUSED|proxy/i);
results.push(r5);
console.log(r5.ok ? 'OK' : `FAIL (exit ${r5.code})`);
if (!r5.ok) console.log(r5.out.slice(-300));

close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
