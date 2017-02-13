'use strict';

import {test, TestContext} from 'ava';
import * as fs from 'fs-extra';
import * as _ from 'lodash';
import * as path from 'path';
import {IAppenderList} from '../lib/notesdb';

const Fixture = require('util.fixture');
const pkg = require('../package.json');
const uuidV4 = require('uuid/v4');
const util = require('../lib/util');
const log4js = require('log4js');

test.after.always((t: TestContext) => {
	console.log('final cleanup: test_util');
	let directories = Fixture.cleanup();
	directories.forEach((directory: string) => {
		t.false(fs.existsSync(directory));
	});
});

test('Adding console logger to log4js', (t: TestContext) => {
	let logger = _.cloneDeep(log4js);
	t.truthy(logger);

	let config: IAppenderList = {
		appenders: [],
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

test('Directory retrieval process', (t: TestContext) => {
	let fixture = new Fixture('tmpdir');
	let root: string = path.join(fixture.dir, uuidV4());
	let dirs: string[] = [];

	_.times(5, () => {
		let dst: string = path.join(root, uuidV4());
		fs.mkdirsSync(dst);
		dirs.push(dst);
	});

	util.getDirectories(root).forEach((directory: string) => {
		t.true(dirs.indexOf(path.join(root, directory)) > -1);
	});
});

test('Get UUID with no dashes', (t: TestContext) => {
	let uuid = util.getUUID(true);

	t.true(uuid && typeof uuid === 'string');
	t.true(uuid.indexOf('-') === -1);
	t.true(uuid.length === 32);
});

test('Get UUID with dashes', (t: TestContext) => {
	let uuid = util.getUUID();

	t.true(uuid && typeof uuid === 'string');
	t.true(uuid.indexOf('-') > -1);
	t.true(uuid.length === 36);
});
