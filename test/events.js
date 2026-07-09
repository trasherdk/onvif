import { describe, it, beforeAll, expect } from 'vitest';
import { createCam, invoke, mockServer, sleep } from './helpers.js';

describe('Events', () => {
	/** @type {import('../src/onvif.ts').Cam} */
	let cam;

	beforeAll(async () => {
		cam = await createCam();
	});

	it('should request device events', async () => {
		const res = await invoke(cam.getEventProperties.bind(cam));
		expect(cam.events.properties).toEqual(res);
	});

	it('should request event service capabilities', async () => {
		const res = await invoke(cam.getEventServiceCapabilities.bind(cam));
		expect(
			[
				'PersistentNotificationStorage',
				'MaxPullPoints',
				'MaxNotificationProducers',
				'WSPausableSubscriptionManagerInterfaceSupport',
				'WSPullPointSupport',
				'WSSubscriptionPolicySupport',
			].every((name) => res[name] !== undefined),
		).toBe(true);
	});

	it('should throws an error in PullMessages method when no pull-point subscription exists', async () => {
		expect(() => cam.pullMessages({})).toThrow();
		await expect(invoke(cam.pullMessages.bind(cam), {})).rejects.toBeTruthy();
	});

	it('should create PullPointSubscription', async () => {
		const data = await invoke(cam.createPullPointSubscription.bind(cam));
		expect(data).toEqual(cam.events.subscription);
	});

	it('should get messages with PullMessage method', async () => {
		const data = await invoke(cam.pullMessages.bind(cam), {});
		expect(['currentTime', 'terminationTime'].every((name) => data[name] !== undefined)).toBe(true);
	});

	it('should create PullPoint subscription via `event` event and receive events from mockup server', async () => {
		delete cam.events.terminationTime;
		let gotMessage = 0;
		const onEvent = () => {
			gotMessage += 1;
		};
		cam.on('event', onEvent);
		await sleep(1000);
		expect(cam.events.terminationTime).not.toBeUndefined();
		expect(gotMessage).toBeGreaterThan(0);
		cam.removeListener('event', onEvent);
	});

	it('should stop pulling when nobody is listen to `event` event', async () => {
		await sleep(1000);
		expect(cam.events.terminationTime).toBeUndefined();
	});

	it('should resume long-pulling when connection with server fails', { timeout: 5000 }, async () => {
		mockServer.connectionBreaker.break = false;
		let gotMessage = 0;
		let pullMessagesCallCount = 0;
		let breakTriggered = false;
		let pullCountAtBreak = 0;

		const pullMessages = cam.pullMessages;
		cam.pullMessages = function (options, callback) {
			pullMessagesCallCount += 1;
			pullMessages.call(cam, options, callback);
		};

		const onEvent = () => {
			if (gotMessage === 10) {
				mockServer.connectionBreaker.break = true;
				breakTriggered = true;
				pullCountAtBreak = pullMessagesCallCount;
			}
			gotMessage += 1;
		};

		cam.on('event', onEvent);
		await sleep(1500);

		try {
			expect(breakTriggered, `connection break was not triggered after 10 events (got ${gotMessage})`).toBe(true);
			expect(gotMessage, `expected events to resume after connection failure, got ${gotMessage}`).toBeGreaterThan(10);
			expect(
				pullMessagesCallCount > pullCountAtBreak,
				'expected more pull attempts after connection break',
			).toBe(true);
		} finally {
			mockServer.connectionBreaker.break = false;
			cam.pullMessages = pullMessages;
			cam.removeListener('event', onEvent);
			await invoke(cam.unsubscribe.bind(cam));
		}
	});

	it('should return an error when calling renew without subscription', async () => {
		await expect(invoke(cam.renew.bind(cam), {})).rejects.toBeInstanceOf(Error);
	});
});
