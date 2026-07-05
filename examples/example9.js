/**
 * Created by Roger Hardiman <opensource@rjh.org.uk>
 *
 * Get a Replay URI to replay recordings from an NVR or camera with onboard storage.
 *
 * Requires ONVIF Recording + Replay services (typical on NVRs, rare on budget IPCs).
 * START/END are placeholders for time-range search (FindRecordings) — not used here.
 */

require('dotenv').config();
const { CAMERA_HOST, USERNAME, PASSWORD, PORT } = process.env;

const START = '2023-02-12T14:50:00Z';
const END = '2023-02-12T14:51:00Z';

const Cam = require('../lib/onvif').Cam;
const flow = require('nimble');

console.log('Connecting to ' + CAMERA_HOST + ':' + PORT);

new Cam({
	hostname: CAMERA_HOST,
	username: USERNAME,
	password: PASSWORD,
	port: PORT,
	timeout: 10000
}, function CamFunc(err) {
	if (err) {
		console.log(err.message || err);
		process.exit(1);
	}

	const camObj = this;

	let gotRecordings = null;
	let gotReplayStream = null;
	let recordingsError = null;
	let replayError = null;

	flow.series([
		function (callback) {
			camObj.getRecordings(function (err, recordings) {
				if (err) {
					recordingsError = err.message || String(err);
				} else {
					gotRecordings = recordings;
				}
				callback();
			});
		},
		function (callback) {
			if (!gotRecordings) {
				return callback();
			}

			let items = gotRecordings;
			if (!Array.isArray(items)) {
				items = [items];
			}
			if (items.length === 0) {
				return callback();
			}

			const token = items[0].recordingToken || items[0].$.token;
			camObj.getReplayUri({
				protocol: 'RTSP',
				recordingToken: token
			}, function (err, replayStream) {
				if (err) {
					replayError = err.message || String(err);
				} else {
					gotReplayStream = replayStream;
				}
				callback();
			});
		},
		function (callback) {
			console.log('------------------------------');
			console.log('Host: ' + CAMERA_HOST + ' Port: ' + PORT);
			console.log('Time window (reference only): ' + START + ' — ' + END);

			if (gotReplayStream && gotReplayStream.uri) {
				console.log('Replay URL: ' + gotReplayStream.uri);
			} else if (recordingsError) {
				console.log('GetRecordings failed: ' + recordingsError);
				console.log('Recording/replay is not supported via ONVIF on this device.');
				console.log('An SD card can still record locally — Yoosee/Xiongmai IPCs usually expose playback only through the app (P2P), not Profile G.');
			} else if (replayError) {
				console.log('GetReplayUri failed: ' + replayError);
			} else if (!gotRecordings) {
				console.log('No recordings returned.');
			} else {
				console.log('No replay URI available.');
			}

			console.log('------------------------------');
			callback();
		}
	], function (flowErr) {
		if (flowErr) {
			console.log('Setup failed:', flowErr.message || flowErr);
			process.exit(1);
		}
		process.exit(0);
	});
});
