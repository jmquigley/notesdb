'use strict';

import test from 'ava';

const path = require('path');
const _ = require('lodash');
const fs = require('fs-extra');
const home = require('expand-home-dir');
const uuidV4 = require('uuid/v4');
const log4js = require('log4js');
const util = require('../util');

let unitTestBaseDir = home(path.join('~/', '.tmp', 'unit-test-data'));
let unitTestDir = home(path.join(unitTestBaseDir, uuidV4()));
if (!fs.existsSync(unitTestDir)) {
	fs.mkdirsSync(unitTestDir);
}


test('Adding console logger to log4js', t => {
	let logger = _.cloneDeep(log4js);
	t.truthy(logger);

	let config = {
		appenders: []
	};

	util.addConsole(config);
	logger.configure(config);

	t.is(config.appenders.length, 1);
	t.is(config.appenders[0].type, 'console');
});


test('Directory retrieval process', t => {
	let root = path.join(unitTestDir, uuidV4());
	let dirs = [];

	_.times(5, () => {
		let dst = path.join(root, uuidV4());
		fs.mkdirsSync(dst);
		dirs.push(dst);
	});

	util.getDirectories(root).forEach(directory => {
		t.true(dirs.indexOf(path.join(root, directory)) > -1);
	});
});


test('Get UUID with no dashes', t => {
	let uuid = util.getUUID(true);

	t.true(uuid && typeof uuid === 'string');
	t.true(uuid.indexOf('-') === -1);
	t.true(uuid.length === 32);
});


test('Get UUID with dashes', t => {
	let uuid = util.getUUID();

	t.true(uuid && typeof uuid === 'string');
	t.true(uuid.indexOf('-') > -1);
	t.true(uuid.length === 36);
});
