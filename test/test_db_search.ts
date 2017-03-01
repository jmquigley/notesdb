'use strict';

import * as assert from 'assert';
import * as fs from 'fs-extra';
import {Artifact} from '../index';
import {Fixture} from 'util.fixture';
import {NotesDB} from '../index';
import {debug, validateDB} from './helpers';

describe('DB Search', () => {

	after(() => {
		debug('final cleanup: test_db_search');
		let directories = Fixture.cleanup();
		directories.forEach((directory: string) => {
			assert(!fs.existsSync(directory));
		});
	});

	it('Test simple search for #1 in simple dB', async () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		await adb.find('#1')
			.then((artifacts: Array<Artifact>) => {
				assert.equal(artifacts.length, 1);
				assert.equal(artifacts[0].filename, 'test1.txt');
				return adb;
			})
			.then(adb.shutdown)
			.catch((err: string) => {
				assert(false, err);
			});
	});

	it(`Test regex search for 'File #[0-9]' in simple dB`, async () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		await adb.find('File #[0-9]')
			.then((artifacts: Array<Artifact>) => {
				assert.equal(artifacts.length, 4);
				assert.equal(artifacts[0].filename, 'test1.txt');
				assert.equal(artifacts[1].filename, 'test2.txt');
				assert.equal(artifacts[2].filename, 'test3.txt');
				assert.equal(artifacts[3].filename, 'test4.txt');
				return adb;
			})
			.then(adb.shutdown)
			.catch((err: string) => {
				assert(false, err);
			});
	});
})

// test search with a database of large artifacts, new test fixture
