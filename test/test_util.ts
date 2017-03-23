'use strict';

import test from 'ava';
import * as fs from 'fs-extra';
import * as _ from 'lodash';
import * as log4js from 'log4js';
import * as path from 'path';
import {Fixture} from 'util.fixture';
import * as uuid from 'uuid';
import {IAppenderList} from '../lib/notesdb';
import {cleanup} from './helpers';

const util = require('../lib/util');
const pkg = require('../package.json');

test.after.always.cb(t => {
	cleanup(path.basename(__filename), t);
});

test('Adding console logger to log4js', t => {
	let logger = _.cloneDeep(log4js);
	t.truthy(logger);

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
			t.is(config.appenders.length, 1);
			t.is(config.appenders[0].type, 'console');
		}
		pkg.debug = !pkg.debug;
	});
});

test('Directory retrieval process', t => {
	let fixture = new Fixture('tmpdir');
	let root: string = path.join(fixture.dir, uuid.v4());
	let dirs: string[] = [];

	_.times(5, () => {
		let dst: string = path.join(root, uuid.v4());
		fs.mkdirsSync(dst);
		dirs.push(dst);
	});

	util.getDirectories(root).forEach((directory: string) => {
		t.true(dirs.indexOf(path.join(root, directory)) > -1);
	});
});

test('Get UUID with no dashes', t => {
	let val = util.getUUID(true);

	t.truthy(val);
	t.is(typeof val, 'string');
	t.is(val.indexOf('-'), -1);
	t.is(val.length, 32);
});

test('Get UUID with dashes', t => {
	let val = util.getUUID();

	t.truthy(val);
	t.is(typeof val, 'string');
	t.true(val.indexOf('-') > -1);
	t.is(val.length, 36);
});
