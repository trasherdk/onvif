import http from 'node:http';
import { Cam } from 'onvif/promises';
import { Server } from 'socket.io';
import rtsp from 'rtsp-ffmpeg';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	buildPageHtml,
	formatConnectError,
	logPtzError,
	readCameraTarget,
	streamFrameSize,
} from './lib.js';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const { USERNAME, PASSWORD, PORT } = process.env;
const HTTP_PORT = Number(process.env.HTTP_PORT || 6147);
const PTZ_SPEED = Number(process.env.PTZ_SPEED || 0.4);
const PTZ_MOVE_MS = Number(process.env.PTZ_MOVE_MS || 800);
const STREAM_MAX_WIDTH = Number(process.env.STREAM_MAX_WIDTH || 640);

let cameraTarget;
try {
	cameraTarget = readCameraTarget(process.env);
} catch (err) {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
}

console.log(`Connecting to ONVIF ${cameraTarget.hostname}:${cameraTarget.port} ...`);

const cam = new Cam({
	hostname: cameraTarget.hostname,
	username: USERNAME,
	password: PASSWORD,
	port: PORT ? parseInt(PORT, 10) : undefined,
});

let pageHtml;

try {
	await cam.connect();
	console.log(`Connected to ${cameraTarget.hostname}:${cameraTarget.port}`);

	const frame = streamFrameSize(cam, STREAM_MAX_WIDTH);
	console.log(`Stream ${frame.source.width}×${frame.source.height} → preview ${frame.width}×${frame.height}`);
	pageHtml = buildPageHtml(frame, PTZ_SPEED);

	const { uri } = await cam.getStreamUri({ protocol: 'RTSP' });
	console.log(`RTSP: ${uri}`);
	const input = uri.replace('://', `://${USERNAME}:${PASSWORD}@`);
	const stream = new rtsp.FFMpeg({
		input,
		resolution: `${frame.width}x${frame.height}`,
		quality: 3,
	});

	const server = http.createServer((_req, res) => {
		res.end(pageHtml);
	});

	const io = new Server(server);

	server.listen(HTTP_PORT, () => {
		console.log(`Open http://localhost:${HTTP_PORT}`);
	});

	io.on('connection', (socket) => {
		const pipeStream = socket.emit.bind(socket, 'data');
		stream.on('disconnect', () => stream.removeListener('data', pipeStream)).on('data', pipeStream);

		socket.on('ptz-move', async ({ x = 0, y = 0, zoom = 0 }) => {
			try {
				await cam.continuousMove({ x, y, zoom, timeout: PTZ_MOVE_MS });
			} catch (err) {
				logPtzError(err, 'move');
			}
		});

		socket.on('ptz-stop', async () => {
			try {
				await cam.stop({ panTilt: true, zoom: true });
			} catch (err) {
				logPtzError(err, 'stop');
			}
		});

		socket.on('disconnect', () => {
			cam.stop({ panTilt: true, zoom: true }).catch(() => {});
		});
	});
} catch (err) {
	console.error(formatConnectError(err, cameraTarget));
	process.exit(1);
}
