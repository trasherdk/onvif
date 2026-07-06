/**
 * Created by Andrew D.Laptev<a.d.laptev@gmail.com> on 1/21/15.
 *
 * Minimal connect + pan demo. Pans right, then back left, then exits.
 * PTZ options match example3.js for cameras that ignore weak or partial moves.
 */

import { Cam } from '../dist/onvif.js';
import 'dotenv/config';

const { CAMERA_HOST, USERNAME, PASSWORD, PORT } = process.env;
const MOVE_DURATION_MS = 2000;
const MOVE_RETRY_MS = 200;

function sleep (ms) {
	return new Promise(function (resolve) {
		setTimeout(resolve, ms);
	});
}

function sendPanMove (cam, moveOptions, callback) {
	const isTilt = moveOptions.y !== 0 && moveOptions.x === 0 && moveOptions.zoom === 0;
	const opts = Object.assign({ timeout: MOVE_DURATION_MS }, moveOptions);
	if (isTilt) {
		opts.onlySendPanTilt = true;
		opts.omitZeroPanTilt = true;
	}
	if (isTilt) {
		cam.continuousMove(opts, function (err) {
			if (err) {
				callback(err);
				return;
			}
			setTimeout(function () {
				cam.continuousMove(opts, callback);
			}, MOVE_RETRY_MS);
		});
	} else {
		cam.continuousMove(opts, callback);
	}
}

function runMove (cam, moveOptions, label) {
	return new Promise(function (resolve, reject) {
		sendPanMove(cam, moveOptions, function (err) {
			if (err) {
				reject(err);
				return;
			}
			console.log('PTZ move sent (' + label + ', ' + (MOVE_DURATION_MS / 1000) + 's)');
			sleep(MOVE_DURATION_MS).then(resolve);
		});
	});
}

function stopPtz (cam) {
	return new Promise(function (resolve) {
		cam.stop({ panTilt: true, zoom: true }, function (err) {
			if (err) {
				console.log('Stop failed:', err.message || err);
			}
			resolve();
		});
	});
}

new Cam({
	hostname: CAMERA_HOST || '192.168.1.81',
	username: USERNAME,
	password: PASSWORD,
	port: PORT,
	timeout: 10000
}, async function (err) {
	if (err) {
		console.log('Connection Failed for ' + CAMERA_HOST + ' Port: ' + PORT + ' Username: ' + USERNAME + ' Password: ' + PASSWORD);
		process.exit(1);
		return;
	}
	console.log('CONNECTED');
	const cam = this;

	try {
		await runMove(cam, { x: 1, y: 0, zoom: 0 }, 'pan right');
		await stopPtz(cam);
		await runMove(cam, { x: -1, y: 0, zoom: 0 }, 'pan left (return)');
		await stopPtz(cam);

		cam.getStreamUri({ protocol: 'RTSP' }, function (streamErr, stream) {
			if (streamErr) {
				console.log('Stream URI failed:', streamErr.message || streamErr);
				process.exit(1);
				return;
			}
			console.log('RTSP stream:', stream.uri);
			process.exit(0);
		});
	} catch (moveErr) {
		console.log('Move failed:', moveErr.message || moveErr);
		process.exit(1);
	}
});
