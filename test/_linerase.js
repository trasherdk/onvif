import { describe, it, expect } from 'vitest';
import { parseString } from 'xml2js';
import { linerase, splitArgs } from '../src/utils.ts';

const parseXml = (xml) =>
	new Promise((resolve, reject) => {
		parseString(xml, (err, result) => (err ? reject(err) : resolve(result)));
	});

describe('Linerase function', () => {
	it('should handle tag', async () => {
		const result = await parseXml('<a><b>text</b><c>text</c></a>');
		expect(linerase(result)).toEqual({
			a: {
				b: 'text',
				c: 'text',
			},
		});
	});

	it('should handle multiply tags', async () => {
		const result = await parseXml('<a><b>text</b><b>text</b></a>');
		expect(linerase(result)).toEqual({
			a: {
				b: ['text', 'text'],
			},
		});
	});

	it('should handle multiply tags deeply', async () => {
		const result = await parseXml(
			'<a><b><c>text</c><d>t</d></b><b><c>text</c><d>t</d></b></a>',
		);
		expect(linerase(result)).toEqual({
			a: {
				b: [
					{ c: 'text', d: 't' },
					{ c: 'text', d: 't' },
				],
			},
		});
	});

	it('should deals with numbers', () => {
		expect(linerase({ a: '34.23' })).toEqual({ a: 34.23 });
		expect(linerase({ a: '34' })).toEqual({ a: 34 });
		expect(linerase({ a: '0.34' })).toEqual({ a: 0.34 });
		expect(linerase({ a: '00.34' })).toEqual({ a: '00.34' });
		expect(linerase({ a: '-0.34' })).toEqual({ a: -0.34 });
		expect(linerase({ a: '-12' })).toEqual({ a: -12 });
		expect(linerase({ a: '000' })).toEqual({ a: '000' });
		expect(linerase({ a: '012' })).toEqual({ a: '012' });
	});

	it('should deals with datetime and converts it to Date', () => {
		expect(linerase({ a: '2015-01-20T16:33:03Z' })).toEqual({
			a: new Date('2015-01-20T16:33:03Z'),
		});
	});
});

describe('splitArgs function', () => {
	it('should parse args', () => {
		const result = splitArgs(
			'algorithm=MD5,realm="happytimesoft",qop="auth,auth-int",nonce="36160F746AFA5913"',
		);
		expect(result).toHaveLength(4);
		expect(result[0]).toBe('algorithm=MD5');
		expect(result[1]).toBe('realm="happytimesoft"');
		expect(result[2]).toBe('qop="auth,auth-int"');
		expect(result[3]).toBe('nonce="36160F746AFA5913"');
	});

	it('should parse args with spaces', () => {
		const result = splitArgs(
			'algorithm=MD5, realm="happytimesoft",qop="auth,auth-int", nonce="36160F746AFA5913"',
		);
		expect(result).toHaveLength(4);
		expect(result[0]).toBe('algorithm=MD5');
		expect(result[1]).toBe('realm="happytimesoft"');
		expect(result[2]).toBe('qop="auth,auth-int"');
		expect(result[3]).toBe('nonce="36160F746AFA5913"');
	});
});
