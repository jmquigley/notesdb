'use strict';

import {test} from 'ava';
import * as fs from 'fs-extra';
import {Artifact} from '../index';
import {Fixture} from 'util.fixture';
import {NotesDB} from '../index';
import {validateDB, validateArtifact} from './helpers';
import {IArtifactSearch, ArtifactType} from '../lib/artifact';

test.after.always((t: any) => {
	console.log('final cleanup: test_db_rename');
	let directories = Fixture.cleanup();
	directories.forEach((directory: string) => {
		t.false(fs.existsSync(directory));
	});
});

test('Renames an artifact', async (t: any) => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	let src: IArtifactSearch = {
		section: 'Default',
		notebook: 'Default',
		filename: 'test1.txt'
	};

	let dst: IArtifactSearch = {
		section: 'Default',
		notebook: 'Default',
		filename: 'test1-copy.txt'
	};

	await adb.rename(src, dst)
		.then((dstArtifact: Artifact) => {

			validateArtifact(dstArtifact, t, {
				section: 'Default',
				notebook: 'Default',
				filename: 'test1-copy.txt',
				type: ArtifactType.SNA
			});

			t.true(fs.existsSync(dstArtifact.absolute()))

			// TODO: add checks for src removal
			// TODO: add checks for dst existence
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(`${t.title}: ${err}`);
		});
});
