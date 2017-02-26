'use strict';

import {test} from 'ava';
import * as fs from 'fs-extra';
import * as path from 'path';
import {Artifact} from '../index';
import {IArtifactSearch, ArtifactType} from '../lib/artifact';
import {Fixture} from 'util.fixture';
import {NotesDB} from '../index';
import {validateDB, validateArtifact} from './helpers';
import {wait} from 'util.wait';

test.after.always((t: any) => {
	console.log('final cleanup: test_db_meta');
	let directories = Fixture.cleanup();
	directories.forEach((directory: string) => {
		t.false(fs.existsSync(directory));
	});
});

test('Get an existing artifact from the schema', async(t: any) => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	let lookup: IArtifactSearch = {
		section: 'Default',
		notebook: 'Default',
		filename: 'test1.txt'
	};
	let metaPath: string = `${lookup.section}${path.sep}${lookup.notebook}${path.sep}${lookup.filename}`;

	await adb.get(lookup)
		.then((artifact: Artifact) => {
			validateArtifact(artifact, t, {
				section: lookup.section,
				notebook: lookup.notebook,
				filename: lookup.filename,
				type: ArtifactType.SNA
			});
			t.is(artifact.buf, 'Test File #1\n');
			t.true(artifact.loaded);

			let tags = artifact.tags;
			let l = ['A', 'B'];

			l.forEach((tag: string) => {
				t.true(tags.indexOf(tag) != -1)
			});

			artifact.addTag('C');
			return adb
		})
		.then(adb.shutdown)
		.then((msg: string) => {
			t.is(msg, 'The database is shutdown.');

			let metaFile = path.join(adb.config.configRoot, 'meta.json');
			let metadata = JSON.parse(fs.readFileSync(metaFile).toString());

			let l = ['A', 'B', 'C'];

			l.forEach((tag: string) => {
				t.true(metadata[metaPath].tags.indexOf(tag) != -1)
			});
		})
		.catch((err: string) => {
			t.fail(`${t.title}: ${err}`);
		});
});

test('Test artifact update time change after change', async (t: any) => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	let lookup: IArtifactSearch = {
		section: 'Default',
		notebook: 'Default',
		filename: 'test1.txt'
	};
	let before: string = JSON.stringify(adb.meta, null, '\t');
	let after: string = '';

	await adb.get(lookup)
		.then((artifact: Artifact) => {
			validateArtifact(artifact, t, {
				section: lookup.section,
				notebook: lookup.notebook,
				filename: lookup.filename,
				type: ArtifactType.SNA
			});
			t.is(artifact.buf, 'Test File #1\n');
			return wait(3, artifact);  // delay 3 seconds and return artifact
		})
		.then((artifact: Artifact) => {
			artifact.buf += 'Added Content';
			return adb
		})
		.then(adb.shutdown)
		.then((msg: string) => {
			t.is(msg, 'The database is shutdown.');
			let metaFile = path.join(adb.config.configRoot, 'meta.json');
			after = JSON.parse(fs.readFileSync(metaFile).toString());
			t.true(before !== after);

			let data: string = fs.readFileSync(path.join(adb.config.dbdir,
			lookup.section, lookup.notebook, lookup.filename)).toString();

			t.is(data, 'Test File #1\nAdded Content');
		})
		.catch((err: string) => {
			t.fail(`${t.title}: ${err}`);
		});
});
