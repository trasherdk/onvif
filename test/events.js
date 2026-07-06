import assert from 'assert';
import { createRequire } from 'module';
import * as onvif from '../src/onvif.ts';

const require = createRequire(import.meta.url);
const serverMockup = require('../test/serverMockup.cjs');

describe('Events', () => {
	let cam = null;
	before((done) => {
		const options = {
			hostname: process.env.HOSTNAME || 'localhost',
			username: process.env.USERNAME || 'admin',
			password: process.env.PASSWORD || '9999',
			port: process.env.PORT ? parseInt(process.env.PORT) : 10101,
		};
		cam = new onvif.Cam(options, done);
	});
	it('should request device events', (done) => {
		cam.getEventProperties((err, res) => {
			assert.strictEqual(err, null);
			assert.deepStrictEqual(cam.events.properties, res);
			done();
		});
	});
	it('should request event service capabilities', (done) => {
		cam.getEventServiceCapabilities((err, res) => {
			assert.strictEqual(err, null);
			assert.ok([
				'PersistentNotificationStorage'
				, 'MaxPullPoints'
				, 'MaxNotificationProducers'
				, 'WSPausableSubscriptionManagerInterfaceSupport'
				, 'WSPullPointSupport'
				, 'WSSubscriptionPolicySupport'
			].every((name) => res[name] !== undefined));
			done();
		});
	});
	it('should throws an error in PullMessages method when no pull-point subscription exists', (done) => {
		assert.throws(() => {
			cam.pullMessages({});
		});
		cam.pullMessages({}, (err) => {
			assert.notEqual(err, null);
			done();
		});
	});
	it('should create PullPointSubscription', (done) => {
		cam.createPullPointSubscription((err, data) => {
			assert.strictEqual(err, null);
			assert.deepStrictEqual(data, cam.events.subscription);
			done();
		});
	});
	it('should get messages with PullMessage method', (done) => {
		cam.pullMessages({}, (err, data) => {
			assert.strictEqual(err, null);
			assert.ok(['currentTime', 'terminationTime'].every((name) => data[name] !== undefined));
			done();
		});
	});
	it('should create PullPoint subscription via `event` event and receive events from mockup server', (done) => {
		delete cam.events.terminationTime; // remove subscribtion if any
		let gotMessage = 0;
		const onEvent = () => gotMessage += 1;
		cam.on('event', onEvent);
		setTimeout(() => {
			assert.ok(cam.events.terminationTime !== undefined);
			assert.ok(gotMessage > 0);
			cam.removeListener('event', onEvent);
			done();
		}, 1000);
	});
	it('should stop pulling when nobody is listen to `event` event', (done) => {
		// wait 1 second for any Pull requests still running when we removed the listener to complete
		setTimeout(() => {
			assert.ok(cam.events.terminationTime === undefined);
			done();
		}, 1000);
	});
	it('should resume long-pulling when connection with server fails', { timeout: 5000 }, function(done) {
		serverMockup.connectionBreaker.break = false;
		let gotMessage = 0;
		let pullMessagesCallCount = 0;
		let breakTriggered = false;
		let pullCountAtBreak = 0;
		let finished = false;

		const cleanup = (err) => {
			if (finished) {
				return;
			}
			finished = true;
			serverMockup.connectionBreaker.break = false;
			cam.pullMessages = pullMessages;
			cam.removeListener('event', onEvent);
			cam.unsubscribe(() => done(err));
		};

		const verifyAndCleanup = () => {
			try {
				assert.ok(breakTriggered, 'connection break was not triggered after 10 events (got ' + gotMessage + ')');
				assert.ok(gotMessage > 10, 'expected events to resume after connection failure, got ' + gotMessage);
				assert.ok(pullMessagesCallCount > pullCountAtBreak, 'expected more pull attempts after connection break');
				cleanup();
			} catch (assertErr) {
				cleanup(assertErr);
			}
		};

		const onEvent = () => {
			if (gotMessage === 10) {
				serverMockup.connectionBreaker.break = true;
				breakTriggered = true;
				pullCountAtBreak = pullMessagesCallCount;
			}
			gotMessage += 1;
		};

		const pullMessages = cam.pullMessages;
		cam.pullMessages = function(options, callback) {
			pullMessagesCallCount += 1;
			pullMessages.call(cam, options, callback);
		};

		cam.on('event', onEvent);
		setTimeout(() => verifyAndCleanup(), 1500);
	});
	it('should return an error when calling renew without subscription', (done) => {
		cam.renew({}, (err) => {
			assert.ok(err instanceof Error);
			done();
		});
	});
});
