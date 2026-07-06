#!/usr/bin/env node
/**
 * Generate ONVIF traffic from this PC while capture runs (baseline / comparison).
 * Run in a second terminal while capture-yoosee.sh is active.
 *
 * Usage:
 *   node scripts/capture-onvif-baseline.js
 */

import 'dotenv/config';
import http from 'http';
import { Cam } from '../dist/onvif.js';

const host = process.env.CAMERA_HOST || '192.168.1.34';
const port = Number(process.env.PORT) || 5000;
const MOVE_RETRY_MS = 200;

function sleep (ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function continuousMove (cam, opts) {
	return new Promise((resolve) => {
		cam.continuousMove(Object.assign({ timeout: 1500 }, opts), () => resolve());
	});
}

function yooseeFireAndForget (cam, action, body) {
	return new Promise(function (resolve) {
		const ptzUri = cam.uri && cam.uri.ptz;
		if (!ptzUri) {
			resolve(new Error('PTZ service URI not available'));
			return;
		}
		const req = http.request({
			hostname: cam.hostname,
			port: cam.port,
			path: ptzUri.pathname + (ptzUri.search || ''),
			method: 'POST',
			headers: {
				'Content-Type': 'application/soap+xml;charset=utf-8;action="http://www.onvif.org/ver20/ptz/wsdl/' + action + '"',
				'Content-Length': Buffer.byteLength(body, 'utf8'),
				'Connection': 'close'
			},
			timeout: 500
		}, function () {});
		req.on('error', function () { resolve(); });
		req.on('timeout', function () { req.destroy(); resolve(); });
		req.write(body);
		req.end();
		req.on('socket', function () {
			setTimeout(function () {
				try { req.destroy(); } catch (_e) {}
				resolve();
			}, 50);
		});
	});
}

function yooseeZoomBurst (cam, zoomSpeed) {
	const token = cam.activeSource.profileToken;
	const moveBody = cam._envelopeHeader() +
		'<ContinuousMove xmlns="http://www.onvif.org/ver20/ptz/wsdl">' +
			'<ProfileToken>' + token + '</ProfileToken>' +
			'<Velocity><Zoom x="' + zoomSpeed + '" xmlns="http://www.onvif.org/ver10/schema"/></Velocity>' +
		'</ContinuousMove>' +
		cam._envelopeFooter();
	const stopBody = cam._envelopeHeader() +
		'<Stop xmlns="http://www.onvif.org/ver20/ptz/wsdl">' +
			'<ProfileToken>' + token + '</ProfileToken>' +
			'<PanTilt>false</PanTilt><Zoom>true</Zoom>' +
		'</Stop>' +
		cam._envelopeFooter();

	function burstOnce () {
		return yooseeFireAndForget(cam, 'ContinuousMove', moveBody)
			.then(function () { return yooseeFireAndForget(cam, 'Stop', stopBody); });
	}

	return burstOnce().then(function () {
		return sleep(MOVE_RETRY_MS).then(burstOnce);
	});
}

new Cam({
	hostname: host,
	username: process.env.USERNAME,
	password: process.env.PASSWORD,
	port: port,
	timeout: 8000
}, async function (err) {
	if (err) {
		console.error('connect failed:', err.message);
		process.exit(1);
	}

	const cam = this;
	console.log('Connected to', host + ':' + port);
	console.log('Sending ONVIF PTZ sequence in 3s (capture should be running)...');
	await sleep(3000);

	console.log('pan right');
	await continuousMove(cam, { x: 1, y: 0, zoom: 0 });
	await sleep(1500);

	console.log('tilt up (double-send)');
	await continuousMove(cam, { x: 0, y: 1, onlySendPanTilt: true, omitZeroPanTilt: true });
	await sleep(MOVE_RETRY_MS);
	await continuousMove(cam, { x: 0, y: 1, onlySendPanTilt: true, omitZeroPanTilt: true });
	await sleep(1500);

	console.log('zoom in (Yoosee burst)');
	await yooseeZoomBurst(cam, 0.5);
	await sleep(1500);

	console.log('zoom out (Yoosee burst)');
	await yooseeZoomBurst(cam, -0.5);
	await sleep(1500);

	console.log('done — stop capture (Ctrl+C) and run analyze-capture.sh');
	process.exit(0);
});
