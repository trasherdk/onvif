/**
 * @param {unknown} err
 * @param {{ hostname: string, port: number }} target
 */
export function formatConnectError(err, target) {
	const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
	const lines = [
		`Cannot connect to ONVIF camera at ${target.hostname}:${target.port}.`,
	];

	if (code === 'EHOSTUNREACH' || code === 'ENETUNREACH') {
		lines.push(
			'The host is not reachable from this machine (no route to that network).',
			'Private addresses like 192.168.x.x only work on the same LAN unless you use VPN (WireGuard, Tailscale, etc.).',
		);
	} else if (code === 'ECONNREFUSED') {
		lines.push('Connection refused — check PORT and that ONVIF is enabled on the camera.');
	} else if (code === 'ETIMEDOUT' || code === 'EHOSTDOWN') {
		lines.push('Timed out — check CAMERA_HOST, firewall rules, and that the camera is online.');
	}

	lines.push(
		'',
		'Check repo root `.env` (see `.env.example`): CAMERA_HOST, USERNAME, PASSWORD, PORT.',
		'Local dev without a camera: pnpm example:app:smoke (mock ONVIF only; no RTSP video).',
	);

	if (err instanceof Error && err.message) {
		lines.push('', err.message);
	}

	return lines.join('\n');
}

/**
 * @param {NodeJS.ProcessEnv} env
 */
export function readCameraTarget(env) {
	const hostname = env.CAMERA_HOST?.trim();
	if (!hostname) {
		throw new Error(
			'CAMERA_HOST is not set. Copy `.env.example` to `.env` or export CAMERA_HOST before starting.',
		);
	}
	const port = env.PORT ? parseInt(env.PORT, 10) : 80;
	if (Number.isNaN(port)) {
		throw new Error(`Invalid PORT: ${env.PORT}`);
	}
	return { hostname, port };
}

/**
 * Scale the main encoder resolution to a max width, keeping aspect ratio (even dimensions for ffmpeg).
 * @param {{ videoEncoderConfigurations?: Array<{ resolution?: { width?: number, height?: number } }>, videoSources?: Array<{ resolution?: { width?: number, height?: number } }> }} cam
 * @param {number} [maxWidth=640]
 */
export function streamFrameSize(cam, maxWidth = 640) {
	const res =
		cam.videoEncoderConfigurations?.[0]?.resolution ??
		cam.videoSources?.[0]?.resolution;
	let srcW = Number(res?.width) || 16;
	let srcH = Number(res?.height) || 9;
	if (srcW <= 0) srcW = 16;
	if (srcH <= 0) srcH = 9;

	let width = maxWidth;
	let height = Math.round((maxWidth * srcH) / srcW);
	width -= width % 2;
	height -= height % 2;
	return { width, height, source: { width: srcW, height: srcH } };
}

/** @param {unknown} err */
export function isBenignPtzReset(err) {
	const code = err && typeof err === 'object' && 'code' in err ? err.code : '';
	return code === 'ECONNRESET';
}

/** @param {unknown} err @param {string} action */
export function logPtzError(err, action) {
	if (isBenignPtzReset(err)) {
		return;
	}
	console.error(`PTZ ${action}:`, err instanceof Error ? err.message : err);
}
