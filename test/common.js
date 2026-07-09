import { describe, it, beforeAll, expect } from 'vitest';
import {
	createCam,
	invoke,
	mockServer,
	onvif,
	sleep,
	synthTest,
} from './helpers.js';

describe('Common functions', () => {
	/** @type {import('../src/onvif.ts').Cam} */
	let cam;

	beforeAll(async () => {
		cam = await createCam();
	});

	describe('default params', () => {
		it('should set default port and path when no one is specified', () => {
			const defaultCam = new onvif.Cam({});
			expect(defaultCam.port).toBe(80);
			expect(defaultCam.path).toBe('/onvif/device_service');
		});
	});

	describe('default autoconnect', () => {
		it('should connect automatically', async () => {
			await new Promise((resolve) => {
				new onvif.Cam({}, () => resolve());
			});
		});
	});

	describe('autoconnect disabled', () => {
		it('should not connect automatically', async () => {
			let called = false;
			new onvif.Cam({ autoconnect: false, timeout: 0 }, () => {
				called = true;
			});
			await sleep(100);
			expect(called).toBe(false);
		});
	});

	describe('_request', () => {
		it('brokes when no arguments are passed', () => {
			expect(() => cam._request()).toThrow();
		});

		it('brokes when no callback is passed', () => {
			expect(() => cam._request({})).toThrow();
		});

		it('brokes when no options.body is passed', () => {
			expect(() => cam._request({}, () => {})).toThrow();
		});

		it('should return an error message when request is bad', async () => {
			await expect(invoke(cam._request.bind(cam), { body: 'test' })).rejects.toBeTruthy();
		});

		it('should return an error message when the network is unreachible', async () => {
			const host = cam.hostname;
			cam.hostname = 'wrong hostname';
			await expect(invoke(cam._request.bind(cam), { body: 'test' })).rejects.toBeTruthy();
			cam.hostname = host;
		});

		it('should return an error message when the server request times out', async () => {
			const host = cam.hostname;
			const oldTimeout = cam.timeout;
			cam.hostname = '10.255.255.1';
			cam.timeout = 500;
			await expect(invoke(cam._request.bind(cam), { body: 'test' })).rejects.toBeTruthy();
			cam.timeout = oldTimeout;
			cam.hostname = host;
		});

		it('should work nice with the proper request body', async () => {
			await invoke(cam._request.bind(cam), {
				body:
					'<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">' +
					'<s:Body xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">' +
					'<GetSystemDateAndTime xmlns="http://www.onvif.org/ver10/device/wsdl"/>' +
					'</s:Body>' +
					'</s:Envelope>',
			});
		});

		it('should handle SOAP Fault as an error (http://www.onvif.org/onvif/ver10/tc/onvif_core_ver10.pdf, pp.45-46)', async () => {
			await expect(
				invoke(cam._request.bind(cam), {
					body:
						'<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">' +
						'<s:Body xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">' +
						'<UnknownCommand xmlns="http://www.onvif.org/ver10/device/wsdl"/>' +
						'</s:Body>' +
						'</s:Envelope>',
				}),
			).rejects.toBeInstanceOf(Error);
		});
	});

	describe('connect', () => {
		it('should connect to the cam, fill startup properties', async () => {
			await invoke(cam.connect.bind(cam));
			expect(cam.capabilities || cam.services).toBeTruthy();
			if (synthTest) {
				expect(cam.uri.ptz).toBeTruthy();
			}
			expect(cam.uri.media).toBeTruthy();
			expect(cam.videoSources).toBeTruthy();
			expect(cam.profiles).toBeTruthy();
			expect(cam.defaultProfile).toBeTruthy();
			expect(cam.activeSource).toBeTruthy();
		});

		it('should return an error when upstart is unfinished', async () => {
			cam.getServices = (_full, cb) => cb(new Error('error'));
			cam.getCapabilities = (cb) => cb(new Error('error'));
			try {
				await expect(invoke(cam.connect.bind(cam))).rejects.toBeTruthy();
			} finally {
				delete cam.getServices;
				delete cam.getCapabilities;
			}
		});
	});

	describe('getSystemDateAndTime', () => {
		it('should return valid date', async () => {
			const data = await invoke(cam.getSystemDateAndTime.bind(cam));
			expect(data).toBeInstanceOf(Date);
		});
	});

	describe('setSystemDateAndTime', () => {
		it('should throws an error when `dateTimeType` is wrong', async () => {
			await expect(
				invoke(cam.setSystemDateAndTime.bind(cam), { dateTimeType: 'blah' }),
			).rejects.toBeTruthy();
		});

		if (synthTest) {
			it('should set system date and time', async () => {
				const data = await invoke(cam.setSystemDateAndTime.bind(cam), {
					dateTimeType: 'Manual',
					dateTime: new Date(),
					daylightSavings: true,
					timezone: 'MSK',
				});
				expect(data).toBeInstanceOf(Date);
			});

			it('should return an error when SetSystemDateAndTime message returns error', async () => {
				mockServer.conf.bad = true;
				await expect(
					invoke(cam.setSystemDateAndTime.bind(cam), {
						dateTimeType: 'Manual',
						dateTime: new Date(),
						daylightSavings: true,
						timezone: 'MSK',
					}),
				).rejects.toBeTruthy();
				delete mockServer.conf.bad;
			});
		}
	});

	describe('getHostname', () => {
		it('should return device name', async () => {
			const data = await invoke(cam.getHostname.bind(cam));
			expect(typeof data.fromDHCP).toBe('boolean');
		});
	});

	describe('getScopes', () => {
		it('should return device scopes as array when different scopes', async () => {
			const data = await invoke(cam.getScopes.bind(cam));
			expect(Array.isArray(data)).toBe(true);
			data.forEach((scope) => {
				expect(scope.scopeDef).toBeTruthy();
				expect(scope.scopeItem).toBeTruthy();
			});
		});

		if (synthTest) {
			it('should return device scopes as array when one scope', async () => {
				mockServer.conf.count = 1;
				const data = await invoke(cam.getScopes.bind(cam));
				expect(Array.isArray(data)).toBe(true);
				data.forEach((scope) => {
					expect(scope.scopeDef).toBeTruthy();
					expect(scope.scopeItem).toBeTruthy();
				});
				delete mockServer.conf.count;
			});

			it('should return device scopes as array when no scopes', async () => {
				mockServer.conf.count = 0;
				const data = await invoke(cam.getScopes.bind(cam));
				expect(Array.isArray(data)).toBe(true);
				data.forEach((scope) => {
					expect(scope.scopeDef).toBeTruthy();
					expect(scope.scopeItem).toBeTruthy();
				});
				delete mockServer.conf.count;
			});
		}
	});

	describe('setScopes', () => {
		it('should set and return device scopes as array', async () => {
			const data = await invoke(cam.setScopes.bind(cam), ['onvif://www.onvif.org/none']);
			expect(Array.isArray(data)).toBe(true);
			data.forEach((scope) => {
				expect(scope.scopeDef).toBeTruthy();
				expect(scope.scopeItem).toBeTruthy();
			});
		});

		if (synthTest) {
			it('should return an error when SetScopes message returns error', async () => {
				mockServer.conf.bad = true;
				await expect(invoke(cam.setScopes.bind(cam), ['onvif://www.onvif.org/none'])).rejects.toBeTruthy();
				delete mockServer.conf.bad;
			});
		}
	});

	describe('getCapabilities', () => {
		it('should return a capabilities object with correspondent properties and also set them into #capability property', async () => {
			const data = await invoke(cam.getCapabilities.bind(cam));
			expect(
				cam.profiles.every((profile) =>
					['name', 'videoSourceConfiguration', 'videoEncoderConfiguration', 'PTZConfiguration'].every(
						(prop) => profile[prop],
					),
				),
			).toBe(true);
			expect(cam.capabilities).toBe(data);
		});

		it('should store PTZ link in ptzUri property', () => {
			expect(cam.uri.ptz.href).toBe(cam.capabilities.PTZ.XAddr);
		});

		it('should store uri links for extensions', () => {
			expect(Object.keys(cam.capabilities.extension).every((ext) => cam.uri[ext])).toBe(true);
		});
	});

	describe('getServiceCapabilities', () => {
		it('should return a service capabilities object and also set them into #serviceCapabilities property', async () => {
			const data = await invoke(cam.getServiceCapabilities.bind(cam));
			if (synthTest) {
				expect(['network', 'security', 'system', 'auxiliaryCommands'].every((prop) => data[prop])).toBe(true);
			} else {
				expect(['network', 'security', 'system'].every((prop) => data[prop])).toBe(true);
			}
			expect(cam.serviceCapabilities).toBe(data);
		});
	});

	describe('getActiveSources', () => {
		it('should find at least one appropriate source', () => {
			cam.getActiveSources();
			expect(cam.defaultProfile).toBeTruthy();
			expect(cam.activeSource).toBeTruthy();
		});

		it('should throws an error when no one profile has actual videosource token', () => {
			const realProfiles = cam.profiles;
			cam.profiles.forEach((profile) => {
				profile.videoSourceConfiguration.sourceToken = 'crap';
			});
			expect(() => cam.getActiveSources()).toThrow(Error);
			cam.profiles = realProfiles;
		});
	});

	describe('getVideoSources', () => {
		it('should return a videosources object with correspondent properties and also set them into videoSources property', async () => {
			const data = await invoke(cam.getVideoSources.bind(cam));
			expect(Array.isArray(data)).toBe(true);
			data.forEach((d) => {
				expect(['$', 'framerate', 'resolution'].every((prop) => d[prop] !== undefined)).toBe(true);
			});
			expect(cam.videoSources).toBe(data);
		});
	});

	describe('getServices', () => {
		it('should return an array of services objects', async () => {
			const data = await invoke(cam.getServices.bind(cam), true);
			expect(Array.isArray(data)).toBe(true);
			expect(data.every((service) => service.namespace && service.XAddr && service.version)).toBe(true);
		});
	});

	describe('getDeviceInformation', () => {
		it('should return an information about device', async () => {
			const data = await invoke(cam.getDeviceInformation.bind(cam));
			expect(
				['manufacturer', 'model', 'firmwareVersion', 'serialNumber', 'hardwareId'].every(
					(prop) => data[prop] !== undefined,
				),
			).toBe(true);
			expect(cam.deviceInformation).toBe(data);
		});
	});

	describe('getStreamUri', () => {
		it('should return a media stream uri', async () => {
			const data = await invoke(cam.getStreamUri.bind(cam), { protocol: 'HTTP' });
			expect(['uri', 'invalidAfterConnect', 'invalidAfterReboot', 'timeout'].every((prop) => data[prop] !== undefined)).toBe(true);
		});

		it('should return a default media stream uri with no options passed', async () => {
			const data = await invoke(cam.getStreamUri.bind(cam));
			expect(['uri', 'invalidAfterConnect', 'invalidAfterReboot', 'timeout'].every((prop) => data[prop] !== undefined)).toBe(true);
		});
	});

	describe('getSnapshotUri', () => {
		it('should return a default media uri with no options passed', async () => {
			const data = await invoke(cam.getSnapshotUri.bind(cam));
			expect(['uri', 'invalidAfterConnect', 'invalidAfterReboot', 'timeout'].every((prop) => data[prop] !== undefined)).toBe(true);
		});
	});

	describe('getNodes', () => {
		it('should return object of nodes and sets them to #nodes', async () => {
			const data = await invoke(cam.getNodes.bind(cam));
			expect(typeof data).toBe('object');
			expect(cam.nodes).toEqual(data);
		});
	});

	describe('getConfigurations', () => {
		it('should return object of configurations and sets them to #configurations', async () => {
			const data = await invoke(cam.getConfigurations.bind(cam));
			expect(typeof data).toBe('object');
			expect(cam.configurations).toEqual(data);
		});
	});

	describe('getConfigurationOptions', () => {
		it('should return an options object for every configuration token', async () => {
			const tokens = Object.keys(cam.configurations);
			await Promise.all(
				tokens.map(async (token) => {
					const data = await invoke(cam.getConfigurationOptions.bind(cam), token);
					expect(typeof data).toBe('object');
				}),
			);
		});
	});

	describe('systemReboot', () => {
		if (synthTest) {
			it('should return a server message', async () => {
				const data = await invoke(cam.systemReboot.bind(cam));
				expect(typeof data).toBe('string');
			});
		}
	});

	describe('EventEmitter', () => {
		let onEvent = null;
		let eventNbr = 0;

		it('should listen with `addListener`', async () => {
			cam.removeAllListeners();
			eventNbr = 0;
			onEvent = () => {
				eventNbr += 1;
			};
			cam.addListener('myEvent', onEvent);
			expect(cam.listeners('myEvent')).toHaveLength(1);
			expect(cam.listenerCount('myEvent')).toBe(1);
			setTimeout(() => cam.emit('myEvent', ''), 250);
			await sleep(1000);
			expect(eventNbr).toBeGreaterThan(0);
		});

		it('should stop listening with `removeListener`', async () => {
			eventNbr = 0;
			cam.removeListener('myEvent', onEvent);
			expect(cam.listeners('myEvent')).toHaveLength(0);
			expect(cam.listenerCount('myEvent')).toBe(0);
			setTimeout(() => cam.emit('myEvent', ''), 250);
			await sleep(500);
			expect(eventNbr).toBe(0);
		});

		it('should listen with `on`', async () => {
			cam.removeAllListeners();
			eventNbr = 0;
			onEvent = () => {
				eventNbr += 1;
			};
			cam.on('myEvent', onEvent);
			expect(cam.listeners('myEvent')).toHaveLength(1);
			expect(cam.listenerCount('myEvent')).toBe(1);
			setTimeout(() => cam.emit('myEvent', ''), 250);
			await sleep(500);
			expect(eventNbr).toBeGreaterThan(0);
		});

		it('should listen only once with `once`', async () => {
			cam.removeAllListeners('myEvent');
			await sleep(100);
			eventNbr = 0;
			onEvent = () => {
				eventNbr += 1;
			};
			cam.once('myEvent', onEvent);
			expect(cam.listeners('myEvent')).toHaveLength(1);
			expect(cam.listenerCount('myEvent')).toBe(1);
			const emit = () => cam.emit('myEvent', '');
			setTimeout(() => {
				setImmediate(emit);
				setImmediate(emit);
			}, 100);
			await sleep(500);
			expect(eventNbr).toBe(1);
			expect(cam.listeners('myEvent')).toHaveLength(0);
			expect(cam.listenerCount('myEvent')).toBe(0);
		});
	});
});
