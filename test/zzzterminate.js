import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const synthTest = !process.env.HOSTNAME;
let serverMockup;
if (synthTest) {
	serverMockup = require('../test/serverMockup.cjs');
}

describe('Terminating', () => {
	if (synthTest) {
		it('should terminate serverMockup', (done) => {
			serverMockup.close();
			done();
		});
	}
});
