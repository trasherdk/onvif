/**
 * Discover ONVIF devices on the local network (WS-Discovery).
 *
 * Created by Roger Hardiman <opensource@rjh.org.uk>
 *
 * Usage:
 *   node examples/example4.js
 *
 * No camera IP required — devices announce themselves on the LAN.
 *
 * Optional .env:
 *   DISCOVERY_TIMEOUT=8000
 *   DISCOVERY_INTERFACE=eth0   auto-picked when only one LAN NIC exists
 *   DISCOVERY_SUBNET_SCAN=0    disable per-host unicast scan (multicast only)
 *   DISCOVERY_CONNECT=1        after discovery, call GetDeviceInformation
 *   USERNAME=...  PASSWORD=...   credentials for DISCOVERY_CONNECT only
 *
 * If you already know the IP, use examples/example2.js instead.
 */

require('dotenv').config();

const os = require('os');
const onvif = require('../lib/onvif');
const { linerase, parseSOAPString } = require('../lib/utils');

const TIMEOUT_MS = parseInt(process.env.DISCOVERY_TIMEOUT || '8000', 10);
const CONNECT = process.env.DISCOVERY_CONNECT === '1' || process.env.DISCOVERY_CONNECT === 'true';
const SUBNET_SCAN = process.env.DISCOVERY_SUBNET_SCAN !== '0';
const { USERNAME, PASSWORD } = process.env;
function pickInterface () {
	if (process.env.DISCOVERY_INTERFACE) {
		return process.env.DISCOVERY_INTERFACE;
	}
	const names = [];
	Object.keys(os.networkInterfaces()).forEach(function (name) {
		os.networkInterfaces()[name].forEach(function (addr) {
			if ((addr.family === 'IPv4' || addr.family === 4) && !addr.internal) {
				names.push(name);
			}
		});
	});
	const unique = names.filter(function (name, index) {
		return names.indexOf(name) === index;
	});
	return unique.length === 1 ? unique[0] : '';
}

const INTERFACE = pickInterface();

const discovered = [];
const errors = [];

/**
 * @param {string} scopes space-separated ONVIF scope URIs
 * @param {string} type e.g. "name", "hardware", "location"
 * @returns {string}
 */
function scopeValue (scopes, type) {
	if (!scopes) {
		return '';
	}
	const prefix = 'onvif://www.onvif.org/' + type + '/';
	for (const entry of scopes.split(/\s+/)) {
		if (entry.startsWith(prefix)) {
			return decodeURIComponent(entry.slice(prefix.length));
		}
	}
	return '';
}

/**
 * @param {string} xml raw ProbeMatch SOAP
 * @param {function(object)} cb
 */
function parseProbeXml (xml, cb) {
	const empty = { urn: '', xaddrs: '', name: '', hardware: '', scopes: '' };
	if (!xml) {
		return cb(empty);
	}
	parseSOAPString(xml, function (err, body) {
		if (err || !body) {
			return cb(empty);
		}
		const data = linerase(body);
		const matches = data.probeMatches && data.probeMatches.probeMatch;
		const match = Array.isArray(matches) ? matches[0] : matches;
		if (!match) {
			return cb(empty);
		}
		cb({
			urn: match.endpointReference && match.endpointReference.address || '',
			xaddrs: match.XAddrs || match.xAddrs || '',
			scopes: match.scopes || '',
			name: scopeValue(match.scopes, 'name'),
			hardware: scopeValue(match.scopes, 'hardware')
		});
	});
}

function formatDevice (cam, rinfo, probe) {
	const xaddrs = (cam.xaddrs || []).map(function (u) { return u.href; });
	const primary = cam.hostname + ':' + cam.port + (cam.path || '');

	return {
		cam: cam,
		ip: rinfo.address,
		replyPort: rinfo.port,
		hostname: cam.hostname,
		port: cam.port,
		path: cam.path || '',
		urn: cam.urn || probe.urn,
		name: probe.name,
		hardware: probe.hardware,
		xaddrs: xaddrs.length ? xaddrs : (probe.xaddrs ? probe.xaddrs.split(/\s+/).filter(Boolean) : []),
		url: primary
	};
}

function printDevice (info, index) {
	console.log('--- Device ' + (index + 1) + ' ---');
	console.log('  IP:        ' + info.ip + ' (WS-Discovery reply from port ' + info.replyPort + ')');
	if (info.name) {
		console.log('  Name:      ' + info.name);
	}
	if (info.hardware) {
		console.log('  Hardware:  ' + info.hardware);
	}
	console.log('  Service:   http://' + info.url);
	if (info.urn) {
		console.log('  URN:       ' + info.urn);
	}
	if (info.xaddrs.length > 1) {
		console.log('  XAddrs:');
		info.xaddrs.forEach(function (addr) {
			console.log('    ' + addr);
		});
	}
}

function connectAndDescribe (cam, done) {
	if (!USERNAME || !PASSWORD) {
		console.log('  (set USERNAME/PASSWORD and DISCOVERY_CONNECT=1 for device info)');
		return done();
	}
	cam.username = USERNAME;
	cam.password = PASSWORD;
	cam.connect(function (err) {
		if (err) {
			console.log('  Connect:   failed — ' + (err.message || err));
			return done();
		}
		cam.getDeviceInformation(function (err2, deviceInfo) {
			if (err2) {
				console.log('  Connect:   ok, GetDeviceInformation failed — ' + (err2.message || err2));
			} else {
				console.log('  Connect:   ' + deviceInfo.manufacturer + ' ' + deviceInfo.model +
					' (fw ' + deviceInfo.firmwareVersion + ', SN ' + deviceInfo.serialNumber + ')');
			}
			done();
		});
	});
}

onvif.Discovery.on('device', function (cam, rinfo, xml) {
	discovered.push({ cam: cam, rinfo: rinfo, xml: xml });
});

onvif.Discovery.on('error', function (err) {
	const msg = err && err.message ? err.message : String(err);
	if (msg.includes('EACCES') && msg.includes('255')) {
		return;
	}
	errors.push(msg);
	console.log('Discovery warning: ' + msg);
});

const probeOptions = {
	timeout: TIMEOUT_MS,
	subnetBroadcast: true,
	subnetScan: SUBNET_SCAN
};
if (INTERFACE) {
	probeOptions.device = INTERFACE;
}

console.log('ONVIF WS-Discovery (timeout ' + TIMEOUT_MS + ' ms' +
	(INTERFACE ? ', interface ' + INTERFACE : ', all interfaces') + ')');
console.log('Multicast 239.255.255.250:3702' +
	(SUBNET_SCAN && INTERFACE ? ', unicast scan of local /24' : '') +
	' — no camera IP required.');
console.log('');

onvif.Discovery.probe(probeOptions, function (err, cams) {
	if (err && (!Array.isArray(err) || err.length === 0)) {
		console.error('Probe failed:', err.message || err);
		process.exit(1);
	}

	let entries = discovered;
	if (entries.length === 0 && cams && cams.length) {
		entries = cams.map(function (cam) {
			return {
				cam: cam,
				rinfo: { address: cam.hostname, port: 3702 },
				xml: ''
			};
		});
	}

	if (entries.length === 0) {
		console.log('No ONVIF devices found.');
		if (errors.length) {
			console.log('There were ' + errors.length + ' warning(s) during discovery.');
		}
		console.log('');
		console.log('Tips:');
		console.log('  - set DISCOVERY_INTERFACE=eth0 if you have multiple NICs');
		console.log('  - discovery only works on the local L2 segment (same subnet/VLAN)');
		console.log('  - if you already know the IP, use examples/example2.js');
		process.exit(0);
	}

	let index = 0;

	function showNext () {
		if (index >= entries.length) {
			console.log('');
			console.log('Found ' + entries.length + ' device(s).');
			process.exit(0);
		}

		const entry = entries[index];
		const deviceIndex = index;
		index += 1;

		parseProbeXml(entry.xml, function (probe) {
			const info = formatDevice(entry.cam, entry.rinfo, probe);
			printDevice(info, deviceIndex);
			if (CONNECT) {
				connectAndDescribe(entry.cam, showNext);
			} else {
				showNext();
			}
		});
	}

	showNext();
});
