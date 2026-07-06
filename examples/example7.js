/**
 * Brute-force scan for ONVIF devices not found by WS-Discovery (example4).
 *
 * Probes each IP in a subnet with ONVIF credentials — for cameras that ignore
 * multicast discovery (common on Yoosee/Xiongmai) or on routed networks.
 *
 * Try example4 first. Use this when discovery returns nothing but you know
 * devices are on the LAN. For a single known IP, use example2 instead.
 *
 * Created by Roger Hardiman <opensource@rjh.org.uk>
 *
 * Usage:
 *   node examples/example7.js
 *
 * Defaults: local /24, port 5000 only. Override with SCAN_RANGE_* in .env.
 *
 * Optional .env:
 *   SCAN_RANGE_START=192.168.1.1
 *   SCAN_RANGE_END=192.168.1.254
 *   SCAN_INTERFACE=eth0
 *   SCAN_PORTS=5000,80
 *   SCAN_TIMEOUT=2500
 *   SCAN_INCLUDE_GATEWAY=1    scan .1 and .255 too (default: skip)
 *   USERNAME=...  PASSWORD=...
 */

import 'dotenv/config';
import net from 'net';
import os from 'os';
import { promisify } from 'util';
import { Cam } from '../dist/onvif.js';

const {
	USERNAME,
	PASSWORD,
	SCAN_RANGE_START,
	SCAN_RANGE_END,
	SCAN_PORTS,
	SCAN_INTERFACE,
	DISCOVERY_INTERFACE,
	SCAN_INCLUDE_GATEWAY
} = process.env;

const TIMEOUT_MS = parseInt(process.env.SCAN_TIMEOUT || '2500', 10);
const TCP_CHECK_MS = Math.min(800, TIMEOUT_MS);
const PROBE_DEADLINE_MS = TIMEOUT_MS + 1500;
const IFACE = SCAN_INTERFACE || DISCOVERY_INTERFACE || '';
const SKIP_GATEWAY = SCAN_INCLUDE_GATEWAY !== '1' && SCAN_INCLUDE_GATEWAY !== 'true';
const PORT_LIST = (SCAN_PORTS || '5000')
	.split(',')
	.map(function (p) { return parseInt(p.trim(), 10); })
	.filter(Boolean);

let foundCount = 0;

function withDeadline (promise, ms, label) {
	return Promise.race([
		promise,
		new Promise(function (_resolve, reject) {
			setTimeout(function () {
				reject(new Error(label || 'probe timeout'));
			}, ms);
		})
	]);
}

function tcpPortOpen (host, port) {
	return new Promise(function (resolve) {
		const socket = net.createConnection({ host: host, port: port });
		let settled = false;
		function finish (open) {
			if (settled) {
				return;
			}
			settled = true;
			socket.destroy();
			resolve(open);
		}
		socket.setTimeout(TCP_CHECK_MS);
		socket.on('connect', function () { finish(true); });
		socket.on('timeout', function () { finish(false); });
		socket.on('error', function () { finish(false); });
	});
}

/**
 * @returns {{start: string, end: string, label: string}|null}
 */
function pickLocalSubnet () {
	const ifaces = IFACE ? { [IFACE]: os.networkInterfaces()[IFACE] } : os.networkInterfaces();
	if (IFACE && !ifaces[IFACE]) {
		console.error('Interface not found: ' + IFACE);
		return null;
	}
	for (const addrs of Object.values(ifaces)) {
		if (!addrs) {
			continue;
		}
		for (const addr of addrs) {
			if ((addr.family === 'IPv4' || addr.family === 4) && !addr.internal) {
				const parts = addr.address.split('.').map(Number);
				const mask = addr.netmask.split('.').map(Number);
				const network = parts.map(function (p, i) { return p & mask[i]; });
				const broadcast = parts.map(function (p, i) { return p | (~mask[i] & 255); });
				return {
					start: network.slice(0, 3).join('.') + '.1',
					end: broadcast.slice(0, 3).join('.') + '.254',
					label: addr.address + '/' + addr.netmask
				};
			}
		}
	}
	return null;
}

/**
 * @param {string} ip
 * @returns {boolean}
 */
function shouldScanIp (ip) {
	if (!SKIP_GATEWAY) {
		return true;
	}
	const last = parseInt(ip.split('.').pop(), 10);
	return last !== 1 && last !== 255;
}

/**
 * @returns {{ips: string[], label: string}}
 */
function buildScanPlan () {
	let ips;
	let label;
	if (SCAN_RANGE_START && SCAN_RANGE_END) {
		ips = generateRange(SCAN_RANGE_START, SCAN_RANGE_END);
		label = SCAN_RANGE_START + ' .. ' + SCAN_RANGE_END;
	} else {
		const local = pickLocalSubnet();
		if (!local) {
			return { ips: [], label: '' };
		}
		ips = generateRange(local.start, local.end);
		label = 'local subnet ' + local.label + ' (' + local.start + ' .. ' + local.end + ')';
	}
	return {
		ips: ips.filter(shouldScanIp),
		label: label + (SKIP_GATEWAY ? ' (skipping .1 and .255)' : '')
	};
}

function createCam (ipEntry, portEntry) {
	return new Cam({
		hostname: ipEntry,
		username: USERNAME,
		password: PASSWORD,
		port: portEntry,
		path: '/onvif/device_service',
		timeout: TIMEOUT_MS,
		autoconnect: false
	});
}

async function probeHost (ipEntry, portEntry) {
	if (!(await tcpPortOpen(ipEntry, portEntry))) {
		return false;
	}

	let camObj;
	try {
		camObj = createCam(ipEntry, portEntry);
		const getTime = promisify(camObj.getSystemDateAndTime).bind(camObj);
		const getInfo = promisify(camObj.getDeviceInformation).bind(camObj);
		const getStream = promisify(camObj.getStreamUri).bind(camObj);

		await withDeadline(getTime(), PROBE_DEADLINE_MS);
		const gotInfo = await withDeadline(getInfo(), PROBE_DEADLINE_MS);

		let streamUri = '';
		try {
			await withDeadline(
				promisify(camObj.getCapabilities).bind(camObj)(),
				PROBE_DEADLINE_MS
			);
			const stream = await withDeadline(getStream({ protocol: 'RTSP' }), PROBE_DEADLINE_MS);
			streamUri = stream && stream.uri ? stream.uri : '';
		} catch (_streamErr) {
			// profiles/capabilities not required to count as found
		}

		foundCount += 1;
		console.log('');
		console.log('FOUND ONVIF device #' + foundCount);
		console.log('------------------------------');
		console.log('Host: ' + ipEntry + '  Port: ' + portEntry);
		console.log('Info: ' + JSON.stringify(gotInfo));
		if (streamUri) {
			console.log('RTSP: ' + streamUri);
		}
		console.log('------------------------------');
		return true;
	} catch (_err) {
		return false;
	}
}

async function main () {
	if (!USERNAME || !PASSWORD) {
		console.error('Set USERNAME and PASSWORD in .env');
		process.exit(1);
	}

	const plan = buildScanPlan();
	if (plan.ips.length === 0) {
		console.error('No scan range. Set SCAN_RANGE_START/SCAN_RANGE_END or connect a LAN interface.');
		process.exit(1);
	}

	const total = plan.ips.length * PORT_LIST.length;
	console.log('Brute-force ONVIF scan (fallback when WS-Discovery finds nothing)');
	console.log('Range:  ' + plan.label);
	console.log('Ports:  ' + PORT_LIST.join(', '));
	console.log('Hosts:  ' + plan.ips.length + '  Probes: ' + total);
	console.log('Timeout: ' + TIMEOUT_MS + 'ms per step (hard cap ' + PROBE_DEADLINE_MS + 'ms)');
	console.log('Tip: try example4.js first for WS-Discovery.');
	console.log('');

	let done = 0;
	const started = Date.now();
	for (let h = 0; h < plan.ips.length; h++) {
		const ipEntry = plan.ips[h];
		process.stdout.write('[' + (h + 1) + '/' + plan.ips.length + '] ' + ipEntry + '                    \r');
		for (const portEntry of PORT_LIST) {
			done += 1;
			await probeHost(ipEntry, portEntry);
		}
	}

	const elapsed = ((Date.now() - started) / 1000).toFixed(1);
	console.log('');
	console.log('Scan complete in ' + elapsed + 's. Found ' + foundCount + ' ONVIF device(s).');
	if (foundCount === 0) {
		console.log('Nothing answered on ports ' + PORT_LIST.join(', ') + ' with these credentials.');
		console.log('Check USERNAME/PASSWORD, SCAN_RANGE_*, or try example4.js (WS-Discovery).');
	}
}

main().catch(function (err) {
	console.error(err);
	process.exit(1);
});

function generateRange (startIp, endIp) {
	var startLong = toLong(startIp);
	var endLong = toLong(endIp);
	if (startLong > endLong) {
		var tmp = startLong;
		startLong = endLong;
		endLong = tmp;
	}
	var rangeArray = [];
	for (var i = startLong; i <= endLong; i++) {
		rangeArray.push(fromLong(i));
	}
	return rangeArray;
}

function toLong (ip) {
	var ipl = 0;
	ip.split('.').forEach(function (octet) {
		ipl <<= 8;
		ipl += parseInt(octet, 10);
	});
	return ipl >>> 0;
}

function fromLong (ipl) {
	return (ipl >>> 24) + '.' + ((ipl >> 16) & 255) + '.' + ((ipl >> 8) & 255) + '.' + (ipl & 255);
}
