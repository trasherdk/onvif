import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	root: path.join(root, 'client'),
	server: {
		middlewareMode: true,
	},
	appType: 'spa',
});
