'use strict';

import test from 'ava';
import * as fs from 'fs-extra';
import * as _ from 'lodash';
import * as path from 'path';
import {Fixture} from 'util.fixture';
import * as uuid from 'uuid';
import {cleanup} from './helpers';

const util = require('../lib/util');

test.after.always.cb(t => {
	cleanup(path.basename(__filename), t);
});

test('Directory retrieval process', t => {
	const fixture = new Fixture('tmpdir');
	const root: string = path.join(fixture.dir, uuid.v4());
	const dirs: string[] = [];

	_.times(5, () => {
		const dst: string = path.join(root, uuid.v4());
		fs.mkdirsSync(dst);
		dirs.push(dst);
	});

	util.getDirectories(root).forEach((directory: string) => {
		t.true(dirs.indexOf(path.join(root, directory)) > -1);
	});
});

test('Get UUID with no dashes', t => {
	const val = util.getUUID(true);

	t.truthy(val);
	t.is(typeof val, 'string');
	t.is(val.indexOf('-'), -1);
	t.is(val.length, 32);
});

test('Get UUID with dashes', t => {
	const val = util.getUUID();

	t.truthy(val);
	t.is(typeof val, 'string');
	t.true(val.indexOf('-') > -1);
	t.is(val.length, 36);
});
