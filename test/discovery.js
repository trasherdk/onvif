import { describe, it, expect } from 'vitest';
import { invoke, onvif } from './helpers.js';

const describeDiscovery = process.platform === 'win32' ? describe.skip : describe;

describeDiscovery('Discovery', () => {
	it('should discover at least one device (mockup server)', async () => {
		const cams = await invoke(onvif.Discovery.probe.bind(onvif.Discovery), { timeout: 1000 });
		expect(cams.length).toBeGreaterThan(0);
		expect(cams[0]).toBeInstanceOf(onvif.Cam);
	});

	it('should discover at least one device with defaults and callback', async () => {
		const cams = await invoke(onvif.Discovery.probe.bind(onvif.Discovery));
		expect(cams.length).toBeGreaterThan(0);
		expect(cams[0]).toBeInstanceOf(onvif.Cam);
	});

	it('should work as event emitter (also test `probe` without params)', async () => {
		const cam = await new Promise((resolve) => {
			onvif.Discovery.once('device', resolve);
			onvif.Discovery.probe();
		});
		expect(cam).toBeTruthy();
		expect(cam).toBeInstanceOf(onvif.Cam);
	});

	it('should return info object instead of Cam object when `resolve` is false', async () => {
		const cam = await new Promise((resolve) => {
			onvif.Discovery.once('device', resolve);
			onvif.Discovery.probe({ resolve: false });
		});
		expect(cam).toBeTruthy();
		expect(cam instanceof onvif.Cam).toBe(false);
	});

	it('should emit and error and return error in callback when response is wrong', async () => {
		let emit = false;
		onvif.Discovery.once('error', (err, xml) => {
			expect(xml).toBe('lollipop');
			expect(err.indexOf('Wrong SOAP message')).toBe(0);
			emit = true;
		});
		await expect(
			invoke(onvif.Discovery.probe.bind(onvif.Discovery), {
				timeout: 1000,
				messageId: 'e7707',
			}),
		).rejects.toBeTruthy();
		expect(emit).toBe(true);
	});

	it('should get single device for one probe', async () => {
		const cams = {};
		const onCam = (data) => {
			if (cams[data.probeMatches.probeMatch.XAddrs]) {
				expect.fail('duplicate device');
			}
			cams[data.probeMatches.probeMatch.XAddrs] = true;
		};
		onvif.Discovery.on('device', onCam);
		const cCams = await invoke(onvif.Discovery.probe.bind(onvif.Discovery), {
			timeout: 1000,
			resolve: false,
			messageId: 'd0-61e',
		});
		expect(Object.keys(cams).length).toBe(cCams.length);
		onvif.Discovery.removeListener('device', onCam);
	});

	it('should get single device for one probe when `lo` is specified', async () => {
		const cams = {};
		const onCam = (data) => {
			if (cams[data.probeMatches.probeMatch.XAddrs]) {
				expect.fail('duplicate device');
			}
			cams[data.probeMatches.probeMatch.XAddrs] = true;
		};
		onvif.Discovery.on('device', onCam);
		const cCams = await invoke(onvif.Discovery.probe.bind(onvif.Discovery), {
			timeout: 1000,
			resolve: false,
			device: 'lo',
		});
		expect(Object.keys(cams).length).toBe(cCams.length);
		onvif.Discovery.removeListener('device', onCam);
	});

	it('should got single device for one probe even when bogus device is specified (fallback to defaultroute)', async () => {
		const cams = {};
		const onCam = (data) => {
			if (cams[data.probeMatches.probeMatch.XAddrs]) {
				expect.fail('duplicate device');
			}
			cams[data.probeMatches.probeMatch.XAddrs] = true;
		};
		onvif.Discovery.on('device', onCam);
		const cCams = await invoke(onvif.Discovery.probe.bind(onvif.Discovery), {
			timeout: 1000,
			resolve: false,
			device: 'loopydevice',
		});
		expect(Object.keys(cams).length).toBe(cCams.length);
		onvif.Discovery.removeListener('device', onCam);
	});
});
