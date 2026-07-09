import { describe, it, beforeAll, expect } from 'vitest';
import { createCam, invoke, onvif } from './helpers.js';

describe('Imaging', () => {
	/** @type {import('../src/onvif.ts').Cam} */
	let cam;
	let settings = null;
	let presetToken = null;

	beforeAll(async () => {
		cam = await createCam();
	});

	it('should request imaging settings with options object', async () => {
		settings = await invoke(cam.getImagingSettings.bind(cam), {});
		expect(['brightness', 'colorSaturation', 'contrast', 'focus', 'sharpness'].every((prop) => settings[prop])).toBe(true);
	});

	it('should do the same without options object', async () => {
		const res = await invoke(cam.getImagingSettings.bind(cam));
		expect(['brightness', 'colorSaturation', 'contrast', 'focus', 'sharpness'].every((prop) => res[prop])).toBe(true);
	});

	it('should set imaging configuration', async () => {
		if (settings === null) {
			throw new Error('getImagingSettings failed');
		}
		const res = await invoke(cam.setImagingSettings.bind(cam), settings);
		expect(res).toBe('');
	});

	it('should get imaging service capabilities', async () => {
		const res = await invoke(cam.getImagingServiceCapabilities.bind(cam));
		expect(typeof res.ImageStabilization).toBe('boolean');
	});

	it('should get current preset when no video source token present', async () => {
		const res = await invoke(cam.getCurrentImagingPreset.bind(cam));
		expect(['token', 'type', 'name'].every((prop) => res[prop])).toBe(true);
	});

	it('should get current preset with video source token', async () => {
		const res = await invoke(cam.getCurrentImagingPreset.bind(cam), cam.activeSource.sourceToken);
		expect(['token', 'type', 'name'].every((prop) => res[prop])).toBe(true);
		presetToken = res.token;
	});

	it('should set current preset with video source and imaging preset tokens', async () => {
		await invoke(cam.setCurrentImagingPreset.bind(cam), { presetToken });
	});

	it('should get Options from the imaging API with video source tokens', async () => {
		const res = await invoke(cam.getVideoSourceOptions.bind(cam), { token: cam.activeSource.sourceToken });
		expect(['brightness', 'colorSaturation', 'contrast'].every((prop) => res[prop])).toBe(true);
	});
});
