import { describe, it, beforeAll, expect } from 'vitest';
import { createCam, invoke, mockServer, synthTest } from './helpers.js';

describe('PTZ', () => {
	/** @type {import('../src/onvif.ts').Cam} */
	let cam;

	beforeAll(async () => {
		cam = await createCam();
	});

	describe('getPresets', () => {
		const isValidPrest = (preset) =>
			typeof preset === 'object' && typeof preset.$.token === 'string';

		it('should return array of preset objects and sets them to #presets', async () => {
			const data = await invoke(cam.getPresets.bind(cam), {});
			expect(Object.keys(data).every((presetName) => isValidPrest(data[presetName]))).toBe(true);
			expect(cam.presets).toBe(data);
		});

		it('should return array of preset objects and sets them to #presets without options', async () => {
			const data = await invoke(cam.getPresets.bind(cam));
			expect(Object.keys(data).every((presetName) => isValidPrest(data[presetName]))).toBe(true);
			expect(cam.presets).toBe(data);
		});

		if (synthTest) {
			it('should work with one preset', async () => {
				mockServer.conf.one = true;
				const data = await invoke(cam.getPresets.bind(cam));
				expect(Object.keys(data).every((presetName) => isValidPrest(data[presetName]))).toBe(true);
				expect(cam.presets).toBe(data);
				delete mockServer.conf.one;
			});
		}
	});

	describe('gotoPreset', () => {
		it('should just run', async () => {
			await invoke(cam.gotoPreset.bind(cam), { preset: Object.keys(cam.profiles)[0] });
		});

		it('should run with speed definition', async () => {
			await invoke(cam.gotoPreset.bind(cam), {
				preset: Object.keys(cam.profiles)[0],
				speed: 0.1,
			});
		});
	});

	describe('setPreset', () => {
		it('should run with preset name (new)', async () => {
			await invoke(cam.setPreset.bind(cam), { presetName: 'testPreset' });
		});

		it('should run with preset token (update)', async () => {
			await invoke(cam.setPreset.bind(cam), { presetToken: 1 });
		});
	});

	describe('removePreset', () => {
		it('should just run', async () => {
			await invoke(cam.removePreset.bind(cam), { presetToken: Object.keys(cam.profiles)[0] });
		});
	});

	describe('gotoHomePosition', () => {
		it('should just run', async () => {
			await invoke(cam.gotoHomePosition.bind(cam), { speed: { x: 1.0, y: 1.0, zoom: 1.0 } });
		});
	});

	describe('setHomePosition', () => {
		it('should just run', async () => {
			await invoke(cam.setHomePosition.bind(cam), {});
		});
	});

	describe('absolute move', () => {
		it('should returns empty RelativeResponseObject', async () => {
			await invoke(cam.absoluteMove.bind(cam), { x: 1, y: 1, zoom: 1 });
		});

		it('should works without callback', () => {
			cam.absoluteMove({ x: 0, y: 0, zoom: 1 });
		});
	});

	describe('relative move', () => {
		it('should returns empty RelativeResponseObject', async () => {
			await invoke(cam.relativeMove.bind(cam), {
				speed: { x: 0.1, y: 0.1 },
				x: 1,
				y: 1,
				zoom: 1,
			});
		});

		it('should works without callback', () => {
			cam.relativeMove({
				speed: { x: 0.1, y: 0.1 },
				x: 1,
				y: 1,
				zoom: 1,
			});
		});
	});

	describe('continuous move', () => {
		it('should returns empty ContinuousResponseObject', async () => {
			await invoke(cam.continuousMove.bind(cam), { x: 0.1, y: 0.1, zoom: 0 });
		});

		it('should set omitted pan-tilt parameters to zero', async () => {
			await invoke(cam.continuousMove.bind(cam), { x: 0.1, zoom: 0 });
		});
	});

	describe('stop', () => {
		it('should stop all movements when options are ommited', async () => {
			await invoke(cam.stop.bind(cam));
		});

		it('should stop only zoom movement', async () => {
			await invoke(cam.stop.bind(cam), { zoom: true });
		});

		it('should stop only pan-tilt movement', async () => {
			await invoke(cam.stop.bind(cam), { panTilt: true });
		});

		it('should stop all movements', async () => {
			await invoke(cam.stop.bind(cam), { zoom: true, panTilt: true });
		});

		it('should work without callback', () => {
			cam.stop({});
			cam.stop();
		});
	});

	describe('getStatus', () => {
		it('should returns position status', async () => {
			await invoke(cam.getStatus.bind(cam), {});
		});
	});
});
