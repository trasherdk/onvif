import { describe, it, beforeAll, expect } from 'vitest';
import { createCam, invoke, mockServer, synthTest } from './helpers.js';

describe('Media', () => {
	/** @type {import('../src/onvif.ts').Cam} */
	let cam;

	beforeAll(async () => {
		cam = await createCam();
	});

	describe('getProfiles', () => {
		it('should create an array of profile objects with correspondent properties', async () => {
			const data = await invoke(cam.getProfiles.bind(cam));
			expect(Object.keys(cam.profiles).length).toBeGreaterThan(0);
			expect(cam.profiles).toBe(data);
		});
	});

	describe('createAndDeleteProfile', () => {
		const name = 'test';
		const token = 'testToken';

		it('should create a new profile with name and token', async () => {
			const res = await invoke(cam.createProfile.bind(cam), { name, token });
			expect(res.$.fixed).toBe(false);
			expect(res.name).toBe(name);
			expect(res.$.token).toBe(token);
		});

		it('should delete already created profile by its token', async () => {
			const res = await invoke(cam.deleteProfile.bind(cam), token);
			expect(res).toBe('');
		});
	});

	describe('getVideoSourceConfigurations', () => {
		it('should return videosource configurations', async () => {
			const res = await invoke(cam.getVideoSourceConfigurations.bind(cam));
			expect(Array.isArray(res)).toBe(true);
			expect(res.every((conf) => conf.name && conf.token && conf.sourceToken && conf.bounds)).toBe(true);
		});
	});

	describe('getVideoEncoderConfiguration', () => {
		it('should return an error when no token present as a parameter or in #videoEncoderConfigurations array and there is no `videoEncoderConfigurations` property', async () => {
			await expect(invoke(cam.getVideoEncoderConfiguration.bind(cam))).rejects.toBeTruthy();
		});
	});

	describe('getVideoEncoderConfigurationOptions', () => {
		it('should return an error when options is given but does not have `configurationToken` or `profileToken`', async () => {
			await expect(invoke(cam.getVideoEncoderConfigurationOptions.bind(cam), {})).rejects.toBeTruthy();
		});
	});

	describe('getVideoEncoderConfigurations', () => {
		it('should return video encoder configurations', async () => {
			const res = await invoke(cam.getVideoEncoderConfigurations.bind(cam));
			expect(['name', '$', 'quality', 'resolution', 'multicast'].every((prop) => res.every((vec) => !!vec[prop]))).toBe(true);
		});
	});

	describe('getVideoEncoderConfiguration', () => {
		it('should return a configuration for the first token in #videoEncoderConfigurations array', async () => {
			const res = await invoke(cam.getVideoEncoderConfiguration.bind(cam));
			expect(['name', '$', 'quality', 'resolution', 'multicast'].every((prop) => !!res[prop])).toBe(true);
		});

		it('should return a configuration for the named token as a first argument', async () => {
			const res = await invoke(
				cam.getVideoEncoderConfiguration.bind(cam),
				cam.videoEncoderConfigurations[0].$.token,
			);
			expect(['name', '$', 'quality', 'resolution', 'multicast'].every((prop) => !!res[prop])).toBe(true);
		});
	});

	describe('getVideoEncoderConfigurationOptions', () => {
		const configurationToken = 'configurationToken';
		const profileToken = 'profileToken';

		it('should return generic configuration options', async () => {
			const res = await invoke(cam.getVideoEncoderConfigurationOptions.bind(cam));
			expect(res.qualityRange).toBeTruthy();
		});

		it('should return a configuration options when `options` is given as a string', async () => {
			const res = await invoke(cam.getVideoEncoderConfigurationOptions.bind(cam), configurationToken);
			expect(res.qualityRange).toBeTruthy();
		});

		it('should return a configuration options when `options` is given as an object with `configurationToken`', async () => {
			const res = await invoke(cam.getVideoEncoderConfigurationOptions.bind(cam), { configurationToken });
			expect(res.qualityRange).toBeTruthy();
		});

		it('should return a configuration options when `options` is given as an object with `profileToken`', async () => {
			const res = await invoke(cam.getVideoEncoderConfigurationOptions.bind(cam), { profileToken });
			expect(res.qualityRange).toBeTruthy();
		});

		it('should return a configuration options when `options` is given as an object with both `configurationToken` and `profileToken`', async () => {
			const res = await invoke(cam.getVideoEncoderConfigurationOptions.bind(cam), {
				configurationToken,
				profileToken,
			});
			expect(res.qualityRange).toBeTruthy();
		});
	});

	describe('setVideoEncoderConfiguration', () => {
		it('should generate an error when no token in the options is present', async () => {
			await expect(invoke(cam.setVideoEncoderConfiguration.bind(cam), {})).rejects.toBeTruthy();
		});

		it('should accept setting existing configuration and return the same configuration by the getVideoEncoderConfiguration method', async () => {
			const res = await invoke(
				cam.setVideoEncoderConfiguration.bind(cam),
				cam.videoEncoderConfigurations[0],
			);
			expect(cam.videoEncoderConfigurations[0]).toEqual(res);
		});

		it('should accept setting some new video configuration based on the existing', async () => {
			const conf = {
				token: cam.videoEncoderConfigurations[0].$.token,
				resolution: cam.videoEncoderConfigurations[0].resolution,
			};
			await invoke(cam.setVideoEncoderConfiguration.bind(cam), conf);
		});

		if (synthTest) {
			it('should emits error with wrong response', async () => {
				mockServer.conf.bad = true;
				await expect(
					invoke(cam.setVideoEncoderConfiguration.bind(cam), cam.videoEncoderConfigurations[0]),
				).rejects.toBeTruthy();
				delete mockServer.conf.bad;
			});
		}
	});

	describe('getAudioSources', () => {
		it('should return audio sources', async () => {
			await invoke(cam.getAudioSources.bind(cam));
		});
	});

	describe('getAudioEncoderConfiguration', () => {
		it('should return an error when no token present as a parameter or in #videoEncoderConfigurations array and there is no `videoEncoderConfigurations` property', async () => {
			await expect(invoke(cam.getAudioEncoderConfiguration.bind(cam))).rejects.toBeTruthy();
		});
	});

	describe('getAudioEncoderConfigurations', () => {
		it('should return audio encoder configurations', async () => {
			await invoke(cam.getAudioEncoderConfigurations.bind(cam));
		});
	});

	describe('getAudioEncoderConfigurationOptions', () => {
		it('should return a configuration options for the first token in #audioEncoderConfigurations array', async () => {
			const res = await invoke(cam.getAudioEncoderConfigurationOptions.bind(cam));
			expect(res.bitrateList).toBeTruthy();
		});

		it('should return a configuration options for the named token as a first argument', async () => {
			const res = await invoke(
				cam.getAudioEncoderConfigurationOptions.bind(cam),
				cam.audioEncoderConfigurations[0].$.token,
			);
			expect(res.bitrateList).toBeTruthy();
		});
	});

	describe('setAudioEncoderConfiguration', () => {
		it('should generate an error when no token in the options is present', async () => {
			await expect(invoke(cam.setAudioEncoderConfiguration.bind(cam), {})).rejects.toBeTruthy();
		});

		it('should accept setting existing configuration and return the same configuration by the getAudioEncoderConfiguration method', async () => {
			const res = await invoke(
				cam.setAudioEncoderConfiguration.bind(cam),
				cam.audioEncoderConfigurations[0],
			);
			expect(cam.audioEncoderConfigurations[0]).toEqual(res);
		});

		it('should accept setting some new audio configuration based on the existing', async () => {
			const conf = {
				token: cam.audioEncoderConfigurations[0].$.token,
				bitrate: cam.audioEncoderConfigurations[0].bitrate,
			};
			await invoke(cam.setAudioEncoderConfiguration.bind(cam), conf);
		});

		if (synthTest) {
			it('should emits error with wrong response', async () => {
				mockServer.conf.bad = true;
				await expect(
					invoke(cam.setAudioEncoderConfiguration.bind(cam), cam.audioEncoderConfigurations[0]),
				).rejects.toBeTruthy();
				delete mockServer.conf.bad;
			});
		}
	});

	describe('getAudioEncoderConfiguration', () => {
		it('should return a configuration for the first token in #videoEncoderConfigurations array', async () => {
			const res = await invoke(cam.getAudioEncoderConfiguration.bind(cam));
			expect(['name', '$', 'multicast'].every((prop) => !!res[prop])).toBe(true);
		});

		it('should return a configuration for the named token as a first argument', async () => {
			const res = await invoke(
				cam.getAudioEncoderConfiguration.bind(cam),
				cam.videoEncoderConfigurations[0].$.token,
			);
			expect(['name', '$', 'multicast'].every((prop) => !!res[prop])).toBe(true);
		});
	});

	describe('addAudioEncoderConfiguration', () => {
		it('should add an AudioEncoderConfiguration to a Profile', async () => {
			await invoke(cam.addAudioEncoderConfiguration.bind(cam), {
				profileToken: 'profileToken',
				configurationToken: 'configurationToken',
			});
		});
	});

	describe('addAudioSourceConfiguration', () => {
		it('should add an AudioSourceConfiguration to a Profile', async () => {
			await invoke(cam.addAudioSourceConfiguration.bind(cam), {
				profileToken: 'profileToken',
				configurationToken: 'configurationToken',
			});
		});
	});

	describe('addVideoEncoderConfiguration', () => {
		it('should add a VideoEncoderConfiguration to a Profile', async () => {
			await invoke(cam.addVideoEncoderConfiguration.bind(cam), {
				profileToken: 'profileToken',
				configurationToken: 'configurationToken',
			});
		});
	});

	describe('addVideoSourceConfiguration', () => {
		it('should add a VideoSourceConfiguration to a Profile', async () => {
			await invoke(cam.addVideoSourceConfiguration.bind(cam), {
				profileToken: 'profileToken',
				configurationToken: 'configurationToken',
			});
		});
	});

	describe('removeAudioEncoderConfiguration', () => {
		it('should remove an AudioEncoderConfiguration from a Profile', async () => {
			await invoke(cam.removeAudioEncoderConfiguration.bind(cam), 'profileToken');
		});
	});

	describe('removeAudioSourceConfiguration', () => {
		it('should remove an AudioSourceConfiguration from a Profile', async () => {
			await invoke(cam.removeAudioSourceConfiguration.bind(cam), 'profileToken');
		});
	});

	describe('getMediaServiceCapabilities', () => {
		it('should return a configuration for the first token in #videoEncoderConfigurations array', async () => {
			const res = await invoke(cam.getMediaServiceCapabilities.bind(cam));
			expect(res).toEqual(cam.mediaCapabilities);
			expect(
				['SnapshotUri', 'Rotation', 'VideoSourceMode', 'OSD', 'TemporaryOSDText', 'EXICompression'].every(
					(prop) => res.$[prop] !== undefined,
				),
			).toBe(true);
			expect(res.profileCapabilities).toBeTruthy();
			expect(['MaximumNumberOfProfiles'].every((prop) => res.profileCapabilities.$[prop] !== undefined)).toBe(true);
			expect(res.streamingCapabilities).toBeTruthy();
			expect(
				['RTPMulticast', 'RTP_TCP', 'RTP_RTSP_TCP', 'NonAggregateControl'].every(
					(prop) => res.streamingCapabilities.$[prop] !== undefined,
				),
			).toBe(true);
		});
	});
});
