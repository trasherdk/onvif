/**
 * NodeJS ONVIF Events
 * This code can run in two ways
 * 1) Receive Events using a PullPoint Subscription and display the events on screen
 *    Tested with Axis (which uses a fixed PullPoint URL with a SubscriberId in the XML)
 *    and with HikVision (which uses a dynamically generated PullPoint URL)
 *
 * 2) Base Subscribe where we start a small HTTP Server on Port 8086, and tell the camera
 *    to send new ONVIF Events to our mini HTTP server.
 *
 * Created by Roger Hardiman <opensource@rjh.org.uk>
 *
 * (c) Roger Hardiman, RJH Technical Consultancy Ltd, November 2019, September 2021
 * Licenced under the MIT Open Source Licence
 */

require('dotenv').config();
const os = require('os');
const { CAMERA_HOST, USERNAME, PASSWORD, PORT, EVENT_RECEIVER_IP, EVENT_RECEIVER_PORT } = process.env;

const EventMethodTypes = { PULL: 'pull', SUBSCRIBE: 'subscribe' };

/**
 * IP of THIS machine on the LAN — the camera must be able to reach it.
 * Only used in SUBSCRIBE mode. Defaults to the first non-loopback IPv4 address,
 * or set EVENT_RECEIVER_IP in .env (e.g. 192.168.1.81 on asus-cctv, 192.168.1.39 on Windows).
 */
function pickReceiverIp () {
	if (EVENT_RECEIVER_IP) {
		return EVENT_RECEIVER_IP;
	}
	for (const addrs of Object.values(os.networkInterfaces())) {
		for (const addr of addrs) {
			if ((addr.family === 'IPv4' || addr.family === 4) && !addr.internal) {
				return addr.address;
			}
		}
	}
	return '127.0.0.1';
}

const EVENT_RECEIVER_IP_ADDRESS = pickReceiverIp();
const EVENT_RECEIVER_PORT_NUM = parseInt(EVENT_RECEIVER_PORT || '8086', 10);

// PICK WHICH EVENT METHOD TO USE
// let EVENT_MODE = EventMethodTypes.PULL;
let EVENT_MODE = EventMethodTypes.SUBSCRIBE;

console.log('*******************************************************************************');
console.log('** This example can switch between PullPoint and Base Subscribe modes');
if (EVENT_MODE === EventMethodTypes.PULL) {
	console.log('** The library will poll for events using a WS-Pull Point Subscription');
}
if (EVENT_MODE === EventMethodTypes.SUBSCRIBE) {
	console.log('** The camera will be told to send ONVIF Events to ' +
		EVENT_RECEIVER_IP_ADDRESS + ':' + EVENT_RECEIVER_PORT_NUM);
}
console.log('*******************************************************************************');

const Cam = require('../lib/onvif').Cam;
let cam_obj = null;
const flow = require('nimble');
const http = require('http');
let server = null;

if (EVENT_MODE === EventMethodTypes.SUBSCRIBE) {
	server = http.createServer(function (request, response) {
		let body = '';
		request.on('data', function (chunk) {
			body += chunk;
		});
		request.on('end', function () {
			if (request.method === 'POST') {
				console.log('HTTP POST Message received on ' + request.url);
				console.log('');
				response.writeHead(200, { 'Content-Type': 'text/plain' });
				response.end('received POST request.');

				if (cam_obj != null) {
					cam_obj.parseEventXML(body, function (err, data) {
						if (err) {
							console.log('Error parsing the XML:', err.message || err);
						} else {
							ReceivedEvent(data, body);
						}
					});
				}
				return;
			}
			console.log('Unexpected connect to HTTP Server to ' + request.url);
			response.writeHead(200, { 'Content-Type': 'text/plain' });
			response.end('Undefined request.');
		});
	});

	server.listen(EVENT_RECEIVER_PORT_NUM);
	console.log('Server running on port ' + EVENT_RECEIVER_PORT_NUM);
}

function hasEventsSupport (cam) {
	const cap = cam.capabilities;
	return !!(cap && cap.events && (cap.events.XAddr || cap.events.WSPullPointSupport));
}

new Cam({
	hostname: CAMERA_HOST,
	username: USERNAME,
	password: PASSWORD,
	port: PORT,
	timeout: 10000,
	preserveAddress: true
}, function CamFunc (err) {
	if (err) {
		console.log('Connect failed:', err.message || err);
		process.exit(1);
	}

	console.log('Connected to ONVIF Device');
	cam_obj = this;

	cam_obj.on('eventsError', function (eventErr) {
		console.log('Events error:', eventErr.message || eventErr);
	});

	let hasEvents = hasEventsSupport(cam_obj);
	let hasTopics = false;

	flow.series([
		function (callback) {
			cam_obj.getDeviceInformation(function (err, info) {
				if (!err && info) {
					console.log('Manufacturer  ' + info.manufacturer);
					console.log('Model         ' + info.model);
					console.log('Firmware      ' + info.firmwareVersion);
					console.log('Serial Number ' + info.serialNumber);
				} else if (err) {
					console.log('GetDeviceInformation failed:', err.message || err);
				}
				callback();
			});
		},
		function (callback) {
			cam_obj.getSystemDateAndTime(function (err, date) {
				if (!err) {
					console.log('Device Time   ' + date);
				}
				callback();
			});
		},
		function (callback) {
			if (hasEvents) {
				console.log('Events URI    ' + (cam_obj.uri.events && cam_obj.uri.events.href || '(unknown)'));
			} else {
				console.log('Events        not advertised in device capabilities');
			}
			callback();
		},
		function (callback) {
			if (!hasEvents) {
				return callback();
			}
			cam_obj.getEventProperties(function (err, data) {
				if (err) {
					console.log('GetEventProperties failed:', err.message || err);
					hasEvents = false;
					return callback();
				}
				if (!data || !data.topicSet) {
					console.log('GetEventProperties returned no topic set');
					return callback();
				}

				const parseNode = function (node, topicPath) {
					for (const child in node) {
						if (child === '$') {
							continue;
						}
						if (child === 'messageDescription') {
							let source = '';
							let dataField = '';
							if (node[child].source) {
								source = JSON.stringify(node[child].source);
							}
							if (node[child].data) {
								dataField = JSON.stringify(node[child].data);
							}
							console.log('Found Event - ' + topicPath.toUpperCase());
							if (source.length > 0) {
								console.log('  Source=' + source);
							}
							if (dataField.length > 0) {
								console.log('  Data=' + dataField);
							}
							hasTopics = true;
							return;
						}
						parseNode(node[child], topicPath + '/' + child);
					}
				};
				parseNode(data.topicSet, '');
				console.log('');
				callback();
			});
		},
		function (callback) {
			if (!hasEvents || !hasTopics) {
				if (EVENT_MODE === EventMethodTypes.PULL) {
					console.log('Pull-point events not started (device has no usable event topics).');
					console.log('This is common on budget Yoosee/Xiongmai cameras.');
				}
				return callback();
			}

			if (EVENT_MODE === EventMethodTypes.SUBSCRIBE) {
				const receiveUrl = 'http://' + EVENT_RECEIVER_IP_ADDRESS + ':' +
					EVENT_RECEIVER_PORT_NUM + '/events/1001';
				cam_obj.subscribe({ url: receiveUrl }, function (err) {
					if (err) {
						console.log('Subscribe failed:', err.message || err);
					} else {
						console.log('Subscribed to events at ' + receiveUrl);
					}
					callback();
				});
				return;
			}

			cam_obj.on('event', function (camMessage, xml) {
				try {
					ReceivedEvent(camMessage, xml);
				} catch (parseErr) {
					console.log('Failed to parse event:', parseErr.message || parseErr);
				}
			});
			console.log('Listening for pull-point events (Ctrl+C to quit)...');
			callback();
		}
	], function (flowErr) {
		if (flowErr) {
			console.log('Setup failed:', flowErr.message || flowErr);
			process.exit(1);
		}
		if (!hasEvents || !hasTopics || EVENT_MODE !== EventMethodTypes.PULL) {
			process.exit(0);
		}
	});
});

function stripNamespaces (topic) {
	let output = '';
	const parts = topic.split('/');
	for (let index = 0; index < parts.length; index++) {
		const stringNoNamespace = parts[index].split(':').pop();
		if (output.length === 0) {
			output += stringNoNamespace;
		} else {
			output += '/' + stringNoNamespace;
		}
	}
	return output;
}

function ReceivedEvent (camMessage, _xml) {
	if (!camMessage || !camMessage.topic || !camMessage.message || !camMessage.message.message) {
		console.log('WARNING: Unexpected event shape:', JSON.stringify(camMessage).slice(0, 200));
		return;
	}

	let eventTopic = camMessage.topic._;
	eventTopic = stripNamespaces(eventTopic);

	const message = camMessage.message.message;
	let eventTime = message.$ && message.$.UtcTime;
	let eventProperty = message.$ && message.$.PropertyOperation;

	let sourceName = null;
	let sourceValue = null;
	if (message.source && message.source.simpleItem) {
		if (Array.isArray(message.source.simpleItem)) {
			sourceName = message.source.simpleItem[0].$.Name;
			sourceValue = message.source.simpleItem[0].$.Value;
			console.log('WARNING: Only processing first Event Source item');
		} else {
			sourceName = message.source.simpleItem.$.Name;
			sourceValue = message.source.simpleItem.$.Value;
		}
	}

	if (message.key) {
		console.log('NOTE: Event has a Key');
	}

	if (message.data && message.data.simpleItem) {
		if (Array.isArray(message.data.simpleItem)) {
			for (let x = 0; x < message.data.simpleItem.length; x++) {
				processEvent(
					eventTime, eventTopic, eventProperty, sourceName, sourceValue,
					message.data.simpleItem[x].$.Name,
					message.data.simpleItem[x].$.Value
				);
			}
		} else {
			processEvent(
				eventTime, eventTopic, eventProperty, sourceName, sourceValue,
				message.data.simpleItem.$.Name,
				message.data.simpleItem.$.Value
			);
		}
	} else if (message.data && message.data.elementItem) {
		console.log('WARNING: Data contains an elementItem');
		processEvent(eventTime, eventTopic, eventProperty, sourceName, sourceValue,
			'elementItem', JSON.stringify(message.data.elementItem));
	} else {
		processEvent(eventTime, eventTopic, eventProperty, sourceName, sourceValue, null, null);
	}
}

function processEvent (eventTime, eventTopic, eventProperty, sourceName, sourceValue, dataName, dataValue) {
	let output = 'EVENT: ';
	if (eventTime && eventTime.toJSON) {
		output += eventTime.toJSON() + ' ';
	}
	output += eventTopic;
	if (typeof eventProperty !== 'undefined') {
		output += ' PROP:' + eventProperty;
	}
	if (typeof sourceName !== 'undefined' && typeof sourceValue !== 'undefined') {
		output += ' SRC:' + sourceName + '=' + sourceValue;
	}
	if (typeof dataName !== 'undefined' && typeof dataValue !== 'undefined') {
		output += ' DATA:' + dataName + '=' + dataValue;
	}
	console.log(output);
}
