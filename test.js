'use strict';

const path = require('path');
const fs = require('fs-extra');
const test = require('ava');
const uuidV4 = require('uuid/v4');
const home = require('expand-home-dir');

let unitTestBaseDir = home(path.join('~/', '.tmp', 'unit-test-data'));
let unitTestDir = home(path.join(unitTestBaseDir, uuidV4()));
if (fs.existsSync(unitTestDir)) {
	fs.mkdirsSync(unitTestDir);
}

test('Empty, template test case', t => {
	console.log(`Using test directory: ${unitTestDir}`);
	t.pass();
});

test.after.always('test cleanup', t => {
	fs.removeSync(unitTestBaseDir);
	t.pass();
});
