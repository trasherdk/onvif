import http from 'node:http';
import dgram from 'node:dgram';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Buffer } from 'node:buffer';
import xml2js from 'xml2js';
import dot from 'dot';

const template = dot.template;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const __xmldir = path.join(__dirname, 'serverMockup/');

const reBody = /<s:Body xmlns:xsi="http:\/\/www.w3.org\/2001\/XMLSchema-instance" xmlns:xsd="http:\/\/www.w3.org\/2001\/XMLSchema">(.*)<\/s:Body>/;
const reCommand = /<(\S*) /;
const reNS = /xmlns="http:\/\/www.onvif.org\/\S*\/(\S*)\/wsdl"/;

if (!global.__onvifServerMockupConf) {
	global.__onvifServerMockupConf = {
		port: parseInt(process.env.PORT) || 10101,
		hostname: process.env.CAMERA_HOST || 'localhost',
		pullPointUrl: '/onvif/subscription?Idx=6',
	};
}
export const conf = global.__onvifServerMockupConf;

const verbose = process.env.VERBOSE || false;
const log = (...msgs) => {
	if (verbose) {
		console.log(...msgs);
	}
};

export const connectionBreaker = {
	break: false,
};

/** @type {import('node:http').Server | undefined} */
let server;
/** @type {import('node:dgram').Socket | undefined} */
let discover;
/** @type {import('node:dgram').Socket | undefined} */
let discoverReply;

const listener = (req, res) => {
	req.setEncoding('utf8');
	const buf = [];
	req.on('data', (chunk) => buf.push(chunk));
	req.on('end', () => {
		let request;
		if (Buffer.isBuffer(buf)) {
			request = Buffer.concat(buf);
		} else {
			request = buf.join('');
		}
		const body = reBody.exec(request);
		if (!body) {
			return res.end();
		}
		const header = body[1];
		let command = reCommand.exec(header)[1];
		if (!command) {
			return res.end();
		}
		const onvifNamespaces = reNS.exec(header);
		let ns = '';
		if (onvifNamespaces) {
			ns = onvifNamespaces[1];
		}
		log('received', ns, command);
		if (fs.existsSync(path.join(__xmldir, `${ns}.${command}.xml`))) {
			command = `${ns}.${command}`;
		}
		if (!fs.existsSync(path.join(__xmldir, `${command}.xml`))) {
			command = 'Error';
		}
		const fileName = path.join(__xmldir, `${command}.xml`);
		log('serving', fileName);
		res.setHeader('Content-Type', 'application/soap+xml;charset=UTF-8');
		if (connectionBreaker.break) {
			log('break connection');
			res.destroy();
			return;
		}
		res.end(template(fs.readFileSync(fileName))(global.__onvifServerMockupConf));
	});
};

if (!global.__onvifServerMockupInit) {
	global.__onvifServerMockupInit = true;

	discoverReply = dgram.createSocket('udp4');
	discover = dgram.createSocket({ type: 'udp4', reuseAddr: true });
	discover.on('error', (err) => {
		if (err.code === 'EADDRINUSE') {
			log('Discovery port already in use, assuming mock server already running');
			return;
		}
		throw err;
	});
	discover.on('message', (msg, rinfo) => {
		log('Discovery received');
		xml2js.parseString(msg.toString(), { explicitCharkey: true, tagNameProcessors: [xml2js.processors.stripPrefix] }, (err, result) => {
			const msgId = result.Envelope.Header[0].MessageID[0]._;
			const discoverMsg = Buffer.from(fs
				.readFileSync(path.join(__xmldir, 'Probe.xml'))
				.toString()
				.replace('RELATES_TO', msgId)
				.replace('SERVICE_URI', `http://${conf.hostname}:${conf.port}/onvif/device_service`),
			);
			switch (msgId) {
				case 'urn:uuid:e7707':
					discoverReply.send(Buffer.from('lollipop'), 0, 8, rinfo.port, rinfo.address);
					break;
				case 'urn:uuid:d0-61e':
					discoverReply.send(discoverMsg, 0, discoverMsg.length, rinfo.port, rinfo.address);
					discoverReply.send(discoverMsg, 0, discoverMsg.length, rinfo.port, rinfo.address);
					break;
				default:
					discoverReply.send(discoverMsg, 0, discoverMsg.length, rinfo.port, rinfo.address);
			}
		});
	});

	log('Listening for Discovery Messages on Port 3702');
	discover.bind(3702, () => {
		try {
			discover.addMembership('239.255.255.250');
		} catch (_memberErr) {
			// ignore — already joined or unavailable
		}
	});

	server = http.createServer(listener);
	server.on('error', (err) => {
		if (err.code !== 'EADDRINUSE') {
			throw err;
		}
		log('HTTP port already in use, assuming mock server already running');
	});
	server.listen(conf.port, (err) => {
		if (err) {
			if (err.code === 'EADDRINUSE') {
				log('HTTP port already in use, assuming mock server already running');
				return;
			}
			throw err;
		}
		log('Listening on port', conf.port);
	});
}

export { server, discover };

export function close() {
	if (!global.__onvifServerMockupInit) {
		return;
	}
	discover?.close();
	discoverReply?.close();
	server?.close();
	global.__onvifServerMockupInit = false;
	log('Closing ServerMockup');
}
