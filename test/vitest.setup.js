import { mockServer } from './helpers.js';

if (mockServer) {
	// serverMockup.cjs starts the HTTP mock on first require.
	void mockServer;
}
