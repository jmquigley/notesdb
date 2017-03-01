'use strict';

import * as assert from 'assert';
import * as fs from 'fs-extra';
import * as _ from 'lodash';
import * as log4js from 'log4js';
import * as path from 'path';
import {Fixture} from 'util.fixture';
import * as uuid from 'uuid';
import {IAppenderList} from '../lib/notesdb';
import {debug} from './helpers';

const util = require('../lib/util');
const pkg = require('../package.json');

describe('Testing Utilities', () => {
	
	after(() => {
		debug('final cleanup: test_util');
		let directories = Fixture.cleanup();
		directories.forEach((directory: string) => {
			assert(!fs.existsSync(directory));
		});
	});

	it('Adding console logger to log4js', () => {
		let logger = _.cloneDeep(log4js);
		assert(logger);

		let config: IAppenderList = {
			appenders: []
		};

		// this tries it with debug=true twice, and with it false twice.  It will
		// test the debug flag, and it will also attempt to add the console twice
		// testing the condition withing the filter.
		_.times(4, () => {
			util.addConsole(config);
			logger.configure(config);

			if (pkg.debug) {
				assert.equal(config.appenders.length, 1);
				assert.equal(config.appenders[0].type, 'console');
			}
			pkg.debug = !pkg.debug;
		});
	});

	it('Directory retrieval process', () => {
		let fixture = new Fixture('tmpdir');
		let root: string = path.join(fixture.dir, uuid.v4());
		let dirs: string[] = [];

		_.times(5, () => {
			let dst: string = path.join(root, uuid.v4());
			fs.mkdirsSync(dst);
			dirs.push(dst);
		});

		util.getDirectories(root).forEach((directory: string) => {
			assert(dirs.indexOf(path.join(root, directory)) > -1);
		});
	});

	it('Get UUID with no dashes', () => {
		let val = util.getUUID(true);

		assert(val && typeof val === 'string');
		assert(val.indexOf('-') === -1);
		assert(val.length === 32);
	});

	it('Get UUID with dashes', () => {
		let val = util.getUUID();

		assert(val && typeof val === 'string');
		assert(val.indexOf('-') > -1);
		assert(val.length === 36);
	});
});