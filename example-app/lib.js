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
 * @param {import('../dist/cam.js').Cam} cam connected camera
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

/**
 * @param {{ width: number, height: number, source: { width: number, height: number } }} frame
 * @param {number} ptzSpeed
 */
export function buildPageHtml(frame, ptzSpeed) {
	const { width, height, source } = frame;
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>ONVIF viewer</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 1rem; }
    #view { display: block; max-width: 100%; height: auto; background: #111; }
    .ptz { display: grid; grid-template-columns: repeat(3, 3rem); gap: 0.25rem; width: max-content; margin-top: 0.75rem; }
    .ptz button { height: 3rem; font-size: 1.1rem; cursor: pointer; }
    .ptz .spacer { visibility: hidden; }
    .hint { color: #555; font-size: 0.9rem; margin-top: 0.5rem; }
  </style>
</head>
<body>
  <canvas id="view" width="${width}" height="${height}"></canvas>
  <p class="hint">${source.width}×${source.height} stream · ${width}×${height} preview</p>
  <div class="ptz" aria-label="PTZ controls">
    <span class="spacer"></span>
    <button type="button" data-x="0" data-y="${ptzSpeed}" title="Up">▲</button>
    <span class="spacer"></span>
    <button type="button" data-x="${-ptzSpeed}" data-y="0" title="Left">◀</button>
    <button type="button" data-stop title="Stop">■</button>
    <button type="button" data-x="${ptzSpeed}" data-y="0" title="Right">▶</button>
    <span class="spacer"></span>
    <button type="button" data-x="0" data-y="${-ptzSpeed}" title="Down">▼</button>
    <span class="spacer"></span>
  </div>
  <p>
    <button type="button" data-x="0" data-y="0" data-z="${ptzSpeed}" title="Zoom in">+</button>
    <button type="button" data-x="0" data-y="0" data-z="${-ptzSpeed}" title="Zoom out">−</button>
  </p>
  <p class="hint">Arrow keys pan/tilt · + / − zoom · release key or ■ to stop</p>
  <script src="/socket.io/socket.io.js"></script>
  <script>
    const socket = io();
    const canvas = document.getElementById('view');
    const ctx = canvas.getContext('2d');

    socket.on('data', (data) => {
      const img = new Image();
      const url = URL.createObjectURL(new Blob([new Uint8Array(data)], { type: 'application/octet-binary' }));
      img.onload = () => {
        URL.revokeObjectURL(url);
        ctx.drawImage(img, 0, 0);
      };
      img.src = url;
    });

    function moveFrom(el) {
      if (el.dataset.stop !== undefined) {
        socket.emit('ptz-stop');
        return;
      }
      socket.emit('ptz-move', {
        x: Number(el.dataset.x || 0),
        y: Number(el.dataset.y || 0),
        zoom: Number(el.dataset.z || 0),
      });
    }

    document.querySelectorAll('button[data-x], button[data-stop]').forEach((btn) => {
      btn.addEventListener('mousedown', (e) => { e.preventDefault(); moveFrom(btn); });
      btn.addEventListener('mouseup', () => socket.emit('ptz-stop'));
      btn.addEventListener('mouseleave', () => socket.emit('ptz-stop'));
    });

    const keys = {
      ArrowUp:    { x: 0, y: ${ptzSpeed}, zoom: 0 },
      ArrowDown:  { x: 0, y: ${-ptzSpeed}, zoom: 0 },
      ArrowLeft:  { x: ${-ptzSpeed}, y: 0, zoom: 0 },
      ArrowRight: { x: ${ptzSpeed}, y: 0, zoom: 0 },
      '+':        { x: 0, y: 0, zoom: ${ptzSpeed} },
      '=':        { x: 0, y: 0, zoom: ${ptzSpeed} },
      '-':        { x: 0, y: 0, zoom: ${-ptzSpeed} },
    };
    const held = new Set();

    window.addEventListener('keydown', (e) => {
      const move = keys[e.key];
      if (!move) return;
      e.preventDefault();
      if (held.has(e.key)) return;
      held.add(e.key);
      socket.emit('ptz-move', move);
    });

    window.addEventListener('keyup', (e) => {
      if (!keys[e.key]) return;
      held.delete(e.key);
      socket.emit('ptz-stop');
    });
  </script>
</body>
</html>`;
}

/** @param {unknown} err @param {string} action */
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

