import { io } from 'socket.io-client';
import './style.css';

const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');
const meta = document.getElementById('meta');
const stage = document.getElementById('stage');

const config = await fetch('/api/config').then((r) => {
	if (!r.ok) throw new Error(`config ${r.status}`);
	return r.json();
});

canvas.width = config.width;
canvas.height = config.height;
stage.style.setProperty('--preview-width', `${config.width}px`);
stage.style.setProperty('--preview-aspect', `${config.width} / ${config.height}`);

function updateMeta() {
	const displayW = Math.round(stage.clientWidth);
	const displayH = Math.round(stage.clientHeight);
	meta.textContent =
		`${config.source.width}×${config.source.height} stream · ${displayW}×${displayH} preview`;
}

updateMeta();
new ResizeObserver(updateMeta).observe(stage);

const speed = config.ptzSpeed;
const moves = {
	up: { x: 0, y: speed, zoom: 0 },
	down: { x: 0, y: -speed, zoom: 0 },
	left: { x: -speed, y: 0, zoom: 0 },
	right: { x: speed, y: 0, zoom: 0 },
	zoomin: { x: 0, y: 0, zoom: speed },
	zoomout: { x: 0, y: 0, zoom: -speed },
};

const socket = io({ path: '/socket.io' });

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
	const move = moves[el.dataset.dir];
	if (move) socket.emit('ptz-move', move);
}

document.querySelectorAll('button[data-dir], button[data-stop]').forEach((btn) => {
	btn.addEventListener('mousedown', (e) => {
		e.preventDefault();
		moveFrom(btn);
	});
	btn.addEventListener('mouseup', () => socket.emit('ptz-stop'));
	btn.addEventListener('mouseleave', () => socket.emit('ptz-stop'));
});

const keys = {
	ArrowUp: moves.up,
	ArrowDown: moves.down,
	ArrowLeft: moves.left,
	ArrowRight: moves.right,
	'+': moves.zoomin,
	'=': moves.zoomin,
	'-': moves.zoomout,
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

if (import.meta.hot) {
	import.meta.hot.accept();
}
