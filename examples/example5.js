/**
 * Created by Andrew D.Laptev<a.d.laptev@gmail.com> on 1/21/15.
 * Edited by Lucas Zanella <me@lucaszanella.com> on 27/08/17.
 * Same as example.json but uses SOCKS5 (useful to access cameras securely through SSH)
 */
import 'dotenv/config';
import { ProxyAgent } from 'proxy-agent';
import http from 'http';
import { Cam } from '../dist/onvif.js';

const { CAMERA_HOST, USERNAME, PASSWORD, PORT, PROXY_URI = 'socks5://localhost:1234' } = process.env;

new Cam({
	hostname: CAMERA_HOST,
	username: USERNAME,
	password: PASSWORD,
	port: PORT,
	agent: new ProxyAgent({
		getProxyForUrl: () => PROXY_URI
	})
}, function(err) {
	if (err) {
		console.log('Connection Failed for ' + CAMERA_HOST + ' Port: ' + PORT + ' Username: ' + USERNAME + ' Password: ' + PASSWORD);
		return;
	}
	console.log('CONNECTED');
	
	this.absoluteMove({
		x: 1
		, y: 1
		, zoom: 1
	});
	
	this.getStreamUri({protocol: 'RTSP'}, function(err, stream) {
		console.log(stream);
		
		http.createServer(function(req, res) {
			res.writeHead(200, {'Content-Type': 'text/html'});
			res.end(
				'<html><body>' +
				'<embed type="application/x-vlc-plugin" target="' + stream.uri + '"></embed>' +
				'</boby></html>');
		}).listen(3030);
		
	});
	
});

