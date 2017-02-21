'use strict';

import {test} from 'ava';
import * as fs from 'fs-extra';
import {Artifact} from '../index';
import {Fixture} from 'util.fixture';
import {NotesDB} from '../index';
import {validateDB} from './helpers';

test.after.always((t: any) => {
	console.log('final cleanup: test_db_search');
	let directories = Fixture.cleanup();
	directories.forEach((directory: string) => {
		t.false(fs.existsSync(directory));
	});
});

test('Test simple search for #1 in simple dB', async (t: any) => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	await adb.find('#1')
		.then((artifacts: Array<Artifact>) => {
			t.is(artifacts.length, 1);
			t.is(artifacts[0].filename, 'test1.txt');

		})
		.catch((err: string) => {
			t.fail(`${t.title}: ${err}`);
		});
});

test(`Test regex search for 'File #[0-9]' in simple dB`, async (t: any) => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	await adb.find('File #[0-9]')
		.then((artifacts: Array<Artifact>) => {
			t.is(artifacts.length, 4);
			t.is(artifacts[0].filename, 'test1.txt');
			t.is(artifacts[1].filename, 'test2.txt');
			t.is(artifacts[2].filename, 'test3.txt');
			t.is(artifacts[3].filename, 'test4.txt');
		})
		.catch((err: string) => {
			t.fail(`${t.title}: ${err}`);
		});
});
