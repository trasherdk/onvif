#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const libDir = path.join(root, 'lib');
const srcDir = path.join(root, 'src');

fs.mkdirSync(srcDir, { recursive: true });

const mixinFiles = new Set([
	'device.js', 'events.js', 'media.js', 'ptz.js', 'imaging.js', 'recording.js', 'replay.js'
]);

function localImport(spec) {
	return spec.startsWith('.') ? `${spec}.js` : spec;
}

function convertMixin(content, name) {
	const fnName = `extend${name.charAt(0).toUpperCase()}${name.slice(1)}`;
	let body = content.replace(/^[\s\S]*?module\.exports\s*=\s*function\s*\(\s*Cam\s*\)\s*\{/, '');
	body = body.replace(/\n\};\s*$/, '');
	body = body.replace(/const linerase = require\(['"]\.\/utils['"]\)\.linerase;\n?/g, '');
	body = body.replace(/\bvar\b/g, 'let');
	return `import { linerase } from './utils.js';\nimport type { CamConstructor } from './cam.js';\n\nexport default function ${fnName}(Cam: CamConstructor): void {${body}\n}\n`;
}

function convertRequires(content) {
	let out = content.replace(/\bvar\b/g, 'let');

	// const \n\tx = require(...),
	out = out.replace(
		/const\s*\n\t(\w+)\s*=\s*require\(['"]([^'"]+)['"]\)/g,
		(_, name, mod) => `import ${name} from '${localImport(mod)}'`
	);

	out = out.replace(
		/let\s*\n\t(\w+)\s*=\s*require\(['"]([^'"]+)['"]\)/g,
		(_, name, mod) => `import ${name} from '${localImport(mod)}'`
	);

	out = out.replace(
		/const\s*\n\t(\w+)\s*=\s*require\(['"]([^'"]+)['"]\),?\n/g,
		(_, name, mod) => `import ${name} from '${localImport(mod)}';\n`
	);

	// Multi-line const a = require, b = require block in cam.js
	out = out.replace(
		/let\s*\n\t([a-zA-Z]+)\s*=\s*require\(['"]([^'"]+)['"]\),?\n\t([a-zA-Z]+)\s*=\s*require\(['"]([^'"]+)['"]\),?\n\t([a-zA-Z]+)\s*=\s*require\(['"]([^'"]+)['"]\),?\n\t([a-zA-Z]+)\s*=\s*require\(['"]([^'"]+)['"]\),?\n\t([a-zA-Z]+)\s*=\s*require\(['"]([^'"]+)['"]\)\.(\w+),?\n\t([a-zA-Z]+)\s*=\s*require\(['"]([^'"]+)['"]\)\.(\w+),?\n\t([a-zA-Z]+)\s*=\s*require\(['"]([^'"]+)['"]\)\.(\w+),?\n\t([a-zA-Z]+)\s*=\s*require\(['"]([^'"]+)['"]\)\.(\w+),?\n\t([a-zA-Z]+)\s*=\s*require\(['"]([^'"]+)['"]\)\.(\w+);/g,
		`import https from 'https';
import crypto from 'crypto';
import events from 'events';
import util from 'util';
import { linerase, parseSOAPString, splitArgs } from './utils.js';
import { parseString } from 'xml2js';
import { processors } from 'xml2js';
const stripPrefix = processors.stripPrefix;`
	);

	out = out.replace(
		/const\s+(\w+)\s*=\s*require\(['"]([^'"]+)['"]\)/g,
		(_, name, mod) => {
			if (mod === './cam') {
				return `import { Cam } from './cam.js'`;
			}
			return `import ${name} from '${localImport(mod)}'`;
		}
	);

	out = out.replace(
		/const\s*\{([^}]+)\}\s*=\s*require\(['"]([^'"]+)['"]\)/g,
		(_, names, mod) => `import { ${names.trim()} } from '${localImport(mod)}'`
	);

	out = out.replace(
		/,\s*\n\t(\w+)\s*=\s*require\(['"]([^'"]+)['"]\)/g,
		(_, name, mod) => `\nimport ${name} from '${localImport(mod)}'`
	);

	return out;
}

function convertCam(content) {
	let out = convertRequires(content);
	const extensionImports = [];
	out = out.replace(/require\(['"](\.\/[^'"]+)['"]\)\(Cam\);?\n?/g, (_, mod) => {
		const base = path.basename(mod, '.js');
		const fn = `extend${base.charAt(0).toUpperCase()}${base.slice(1)}`;
		extensionImports.push(`import ${fn} from '${localImport(mod)}';`);
		return `${fn}(Cam);\n`;
	});
	out = out.replace(
		/module\.exports = \{\n\tCam: Cam\n\};\n\n/,
		'export { Cam };\nexport type CamConstructor = typeof Cam;\n\n'
	);
	return extensionImports.join('\n') + '\n\n' + out;
}

function convertDiscovery(content) {
	let out = convertRequires(content);
	out = out.replace(
		/import Cam from '\.\/cam\.js'\.Cam,\n[\s\S]*?os = require\('os'\);/,
		`import { createSocket } from 'dgram';
import { EventEmitter } from 'events';
import os from 'os';
import { Cam } from './cam.js';
import { guid, linerase, parseSOAPString } from './utils.js';`
	);
	out = out.replace(/require\('dgram'\)\.createSocket/g, 'createSocket');
	out = out.replace(/Object\.create\(new events\.EventEmitter\(\)\)/, 'Object.create(new EventEmitter())');
	out = out.replace(/module\.exports = \{\n\tDiscovery: Discovery\n\};/, 'export { Discovery };');
	return out;
}

function convertUtils(content) {
	let out = convertRequires(content);
	out = out.replace(
		/const xml2js = require\('xml2js'\),/,
		"import { parseString as xml2jsParseString } from 'xml2js';\nconst xml2js = { parseString: xml2jsParseString };"
	);
	out = out.replace(/module\.exports = \{([^}]+)\};/, (_, e) => {
		const names = e.split(',').map(s => s.trim()).filter(Boolean);
		return `export { ${names.join(', ')} };`;
	});
	return out;
}

for (const file of fs.readdirSync(libDir).filter(f => f.endsWith('.js'))) {
	const raw = fs.readFileSync(path.join(libDir, file), 'utf8');
	const base = file.replace(/\.js$/, '');
	let converted;
	if (mixinFiles.has(file)) {
		converted = convertMixin(raw, base);
	} else if (file === 'cam.js') {
		converted = convertCam(raw);
	} else if (file === 'discovery.js') {
		converted = convertDiscovery(raw);
	} else if (file === 'utils.js') {
		converted = convertUtils(raw);
	} else if (file === 'onvif.js') {
		converted = "export { Cam, type CamConstructor } from './cam.js';\nexport { Discovery } from './discovery.js';\n";
	} else {
		converted = convertRequires(raw);
		const exportMatch = converted.match(/module\.exports = \{([^}]+)\}/);
		if (exportMatch) {
			converted = converted.replace(/module\.exports = \{([^}]+)\};?\s*$/m, (_, e) => {
				const names = e.split(',').map(s => s.trim()).filter(Boolean);
				return names.map(n => `export { ${n} };`).join('\n');
			});
		}
	}
	fs.writeFileSync(path.join(srcDir, `${base}.ts`), converted);
	console.log('converted', file);
}
