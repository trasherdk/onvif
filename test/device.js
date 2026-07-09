import { describe, it, beforeAll, expect } from 'vitest';
import { createCam, invoke, synthTest } from './helpers.js';

describe('Device', () => {
	/** @type {import('../src/onvif.ts').Cam} */
	let cam;

	beforeAll(async () => {
		cam = await createCam();
	});

	describe('getNTP', () => {
		it('should return NTP settings', async () => {
			await invoke(cam.getNTP.bind(cam));
		});
	});

	describe('setNTP', () => {
		if (synthTest) {
			it('should set NTP with ipv4', async () => {
				await invoke(cam.setNTP.bind(cam), {
					fromDHCP: false,
					type: 'IPv4',
					ipv4Address: 'localhost',
				});
			});

			it('should set NTP with ipv6', async () => {
				await invoke(cam.setNTP.bind(cam), {
					fromDHCP: false,
					type: 'IPv6',
					ipv6Address: '::1/128',
					dnsName: '8.8.8.8',
				});
			});

			it('should set NTP from DHCP', async () => {
				await invoke(cam.setNTP.bind(cam), { fromDHCP: true });
			});

			it('should set multiple NTPs', async () => {
				await invoke(cam.setNTP.bind(cam), {
					fromDHCP: false,
					NTPManual: [
						{ type: 'IPv4', ipv4Address: 'localhost' },
						{ type: 'IPv6', ipv6Address: '::1/128', dnsName: '8.8.8.8' },
					],
				});
			});
		}
	});

	describe('getNetworkInterfaces', () => {
		it('should return a NetworkInterface', async () => {
			const networkInterfaces = await invoke(cam.getNetworkInterfaces.bind(cam));
			expect(networkInterfaces[0].$.token).toBe('eth0');
		});
	});

	describe('setNetworkInterfaces', () => {
		it('should set manual IPv4, update the Cam object with the new IP and return RebootNeeded', async () => {
			const currentIP = cam.hostname;
			const data = await invoke(cam.setNetworkInterfaces.bind(cam), {
				interfaceToken: 'interfaceToken',
				networkInterface: {
					enabled: true,
					IPv4: {
						enabled: true,
						DHCP: false,
						manual: { address: '127.0.0.1', prefixLength: 24 },
					},
				},
			});
			const newIP = cam.hostname;
			cam.hostname = currentIP;
			expect(newIP).toBe('127.0.0.1');
			expect(data.rebootNeeded).toBe(false);
		});

		it('should set manual IPv6, update the Cam object with the new IP and return RebootNeeded', async () => {
			const currentIP = cam.hostname;
			const data = await invoke(cam.setNetworkInterfaces.bind(cam), {
				interfaceToken: 'interfaceToken',
				networkInterface: {
					enabled: true,
					IPv6: {
						enabled: true,
						DHCP: false,
						manual: { address: '::1', prefixLength: 24 },
					},
				},
			});
			const newIP = cam.hostname;
			cam.hostname = currentIP;
			expect(newIP).toBe('::1');
			expect(data.rebootNeeded).toBe(false);
		});
	});

	describe('getNetworkDefaultGateway', () => {
		it('should return a NetworkGateway', async () => {
			const data = await invoke(cam.getNetworkDefaultGateway.bind(cam));
			expect(data.IPv4Address).toBe('192.168.0.1');
			expect(data.IPv6Address).toBe('');
		});
	});

	describe('setNetworkDefaultGateway', () => {
		it('should set IPv4 address and return a NetworkGateway', async () => {
			const data = await invoke(cam.setNetworkDefaultGateway.bind(cam), {
				IPv4Address: '192.168.0.2',
			});
			expect(typeof data.IPv4Address).toBe('string');
			expect(typeof data.IPv6Address).toBe('string');
		});

		it('should set IPv6 address and return a NetworkGateway', async () => {
			const data = await invoke(cam.setNetworkDefaultGateway.bind(cam), {
				IPv6Address: '::2',
			});
			expect(typeof data.IPv4Address).toBe('string');
			expect(typeof data.IPv6Address).toBe('string');
		});
	});

	describe('getDNS', () => {
		it('should return a DNSInformation', async () => {
			const data = await invoke(cam.getDNS.bind(cam));
			expect(data.fromDHCP).toBe(false);
			expect(Array.isArray(data.DNSManual)).toBe(true);
			expect(data.DNSManual[0].type).toBe('IPv4');
			expect(data.DNSManual[0].IPv4Address).toBe('4.4.4.4');
			expect(data.DNSManual[1].type).toBe('IPv4');
			expect(data.DNSManual[1].IPv4Address).toBe('8.8.8.8');
		});
	});

	describe('setDNS', () => {
		it('should set IPv4 address and return a DNSInformation', async () => {
			const data = await invoke(cam.setDNS.bind(cam), {
				fromDHCP: false,
				DNSManual: [
					{ type: 'IPv4', IPv4Address: '5.5.5.5' },
					{ type: 'IPv4', IPv4Address: '9.9.9.9' },
				],
			});
			expect(Array.isArray(data.DNSManual)).toBe(true);
		});

		it('should set IPv6 address and return a DNSInformation', async () => {
			const data = await invoke(cam.setDNS.bind(cam), {
				fromDHCP: false,
				DNSManual: [
					{ type: 'IPv6', IPv6Address: '2001:4860:4860::8888' },
					{ type: 'IPv6', IPv6Address: '2001:4860:4860::8844' },
				],
			});
			expect(Array.isArray(data.DNSManual)).toBe(true);
		});
	});

	describe('setSystemFactoryDefault', () => {
		it('should request a soft factory default', async () => {
			await invoke(cam.setSystemFactoryDefault.bind(cam));
		});

		it('should request a hard factory default', async () => {
			await invoke(cam.setSystemFactoryDefault.bind(cam), true);
		});
	});

	describe('getUsers', () => {
		it('should return a list of user', async () => {
			const data = await invoke(cam.getUsers.bind(cam));
			expect(Array.isArray(data)).toBe(true);
			expect(data[0].username).toBe('admin');
			expect(data[0].password).toBe('admin');
			expect(data[0].userLevel).toBe('Administrator');
		});
	});

	describe('createUsers', () => {
		it('should create users', async () => {
			const data = await invoke(cam.createUsers.bind(cam), [
				{ username: 'username1', password: 'password1', userLevel: 'User' },
				{ username: 'username2', password: 'password2', userLevel: 'User' },
			]);
			expect(Array.isArray(data)).toBe(true);
		});
	});

	describe('setUsers', () => {
		it('should set users', async () => {
			const data = await invoke(cam.setUsers.bind(cam), [
				{ username: 'username1', password: 'password1', userLevel: 'User' },
				{ username: 'username2', password: 'password2', userLevel: 'User' },
			]);
			expect(Array.isArray(data)).toBe(true);
		});
	});

	describe('deleteUsers', () => {
		it('should delete users', async () => {
			const data = await invoke(cam.deleteUsers.bind(cam), [
				{ username: 'username1', password: 'password1', userLevel: 'User' },
				'username2',
			]);
			expect(Array.isArray(data)).toBe(true);
		});
	});

	describe('SendAuxiliaryCommand', () => {
		it('should send auxiliary command', async () => {
			await invoke(cam.sendAuxiliaryCommand.bind(cam), { data: 'tt:Wiper|On' });
		});
	});
});
