# Example app (README quick example)

Live RTSP viewer in the browser with on-screen and keyboard PTZ controls.

## Prerequisites

- Node.js 18+
- [ffmpeg](https://ffmpeg.org/) on `PATH` (`sudo apt install ffmpeg`, etc.)
- PTZ-capable ONVIF camera
- Camera credentials in the repo root `.env` (copy from `.env.example`)

## Run

From the repo root:

```shell
pnpm install --dir example-app
pnpm example:app
```

Or from this directory:

```shell
pnpm install
pnpm start
```

Open http://localhost:6147 (override with `HTTP_PORT`).

## PTZ controls

- **Buttons** on the page: pan/tilt arrows, +/− zoom, ■ stop
- **Keyboard**: arrow keys pan/tilt, `+` / `−` zoom (release key to stop)
- Optional env: `PTZ_SPEED` (default `0.4`), `PTZ_MOVE_MS` (default `800`)

Uses `continuousMove` / `stop` over ONVIF; same idea as `examples/example3.js`.

## Network / `EHOSTUNREACH`

`CAMERA_HOST` must be reachable **from the machine running Node**, not just from your browser.

- `192.168.x.x` addresses are local LAN only. If the camera is on a home network in another country, you need VPN (WireGuard, Tailscale, etc.) or another tunnel into that subnet.
- Override for a one-off test: `CAMERA_HOST=10.0.0.5 PORT=80 pnpm example:app`
- Automated local test without a camera (ONVIF mock only, no RTSP video): `pnpm example:app:smoke` from the repo root.

Stack: `onvif/promises`, `socket.io`, `rtsp-ffmpeg`.
