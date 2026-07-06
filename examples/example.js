/**
 * Created by Andrew D.Laptev<a.d.laptev@gmail.com> on 1/21/15.
 */

import http from 'http';
import { Cam } from '../dist/onvif.js';
import 'dotenv/config';
const { CAMERA_HOST, USERNAME, PASSWORD, PORT } = process.env;

new Cam({
	hostname: CAMERA_HOST || '192.168.1.81',
	username: USERNAME,
	password: PASSWORD,
	port: PORT
}, function (err) {
	if (err) {
		console.log('Connection Failed for ' + CAMERA_HOST + ' Port: ' + PORT + ' Username: ' + USERNAME + ' Password: ' + PASSWORD);
		return;
	}
	console.log('CONNECTED');
	this.continuousMove({ x: 0.3, y: 0, zoom: 0, timeout: 2000 }, function (err) {
		if (err) {
			console.log('Move failed:', err.message || err);
			return;
		}
		console.log('PTZ move sent (camera auto-stops after 2s)');
	});
	this.getStreamUri({ protocol: 'RTSP' }, function (err, stream) {
		http.createServer(function (req, res) {
			res.writeHead(200, { 'Content-Type': 'text/html' });
			res.end(
				'<html><body>' +
				'<embed type="application/x-vlc-plugin" target="' + stream.uri + '"></embed>' +
				'</boby></html>');
		}).listen(3030);
	});
});