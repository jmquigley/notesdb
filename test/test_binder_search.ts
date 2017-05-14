'use strict';

import test from 'ava';
import * as path from 'path';
import {Fixture} from 'util.fixture';
import {Artifact, Binder} from '../index';
import {cleanup, validateBinder} from './helpers';

test.after.always.cb(t => {
	cleanup(path.basename(__filename), t);
});

test('Test simple search for #1 in simple dB', async t => {
	const fixture = new Fixture('simple-db');
	const adb = new Binder({
		root: fixture.dir
	});

	validateBinder(t, adb, 'sampledb', fixture.dir, adb.initialized);

	await adb.find('#1')
		.then((artifacts: Artifact[]) => {
			t.is(artifacts.length, 1);
			t.is(artifacts[0].filename, 'test1.txt');
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(err);
		});
});

test(`Test regex search for 'File #[0-9]' in simple dB`, async t => {
	const fixture = new Fixture('simple-db');
	const adb = new Binder({
		root: fixture.dir
	});

	validateBinder(t, adb, 'sampledb', fixture.dir, adb.initialized);

	await adb.find('File #[0-9]')
		.then((artifacts: Artifact[]) => {
			t.is(artifacts.length, 4);
			t.is(artifacts[0].filename, 'test1.txt');
			t.is(artifacts[1].filename, 'test2.txt');
			t.is(artifacts[2].filename, 'test3.txt');
			t.is(artifacts[3].filename, 'test4.txt');
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(err);
		});
});

// test search with a database of large artifacts, new test fixture
