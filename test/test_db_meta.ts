'use strict';

import test from 'ava';
import * as fs from 'fs-extra';
import * as path from 'path';
import {Fixture} from 'util.fixture';
import {waitPromise} from 'util.wait';
import {Artifact, NotesDB} from '../index';
import {ArtifactType, IArtifactSearch} from '../lib/artifact';
import {cleanup, validateArtifact, validateDB} from './helpers';

test.after.always.cb(t => {
	cleanup(path.basename(__filename), t);
});

test('Get an existing artifact from the schema', async t => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(t, adb, 'sampledb', fixture.dir, adb.initialized);

	let lookup: IArtifactSearch = {
		section: 'Default',
		notebook: 'Default',
		filename: 'test1.txt'
	};
	let metaPath: string = `${lookup.section}/${lookup.notebook}/${lookup.filename}`;

	await adb.get(lookup)
		.then((artifact: Artifact) => {
			validateArtifact(t, artifact, {
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
				t.true(tags.indexOf(tag) !== -1);
			});

			artifact.addTag('C');
			return adb;
		})
		.then(adb.shutdown)
		.then((msg: string) => {
			t.is(msg, 'The database is shutdown.');

			let metaFile = path.join(adb.config.configRoot, 'meta.json');
			let metadata = JSON.parse(fs.readFileSync(metaFile).toString());

			let l = ['A', 'B', 'C'];

			l.forEach((tag: string) => {
				t.true(metadata[metaPath].tags.indexOf(tag) !== -1);
			});
		})
		.catch((err: string) => {
			t.fail(err);
		});
});

test('Test artifact update time change after change', async t => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(t, adb, 'sampledb', fixture.dir, adb.initialized);

	let lookup: IArtifactSearch = {
		section: 'Default',
		notebook: 'Default',
		filename: 'test1.txt'
	};
	let before: string = JSON.stringify(adb.meta, null, '\t');
	let after: string = '';

	await adb.get(lookup)
		.then((artifact: Artifact) => {
			validateArtifact(t, artifact, {
				section: lookup.section,
				notebook: lookup.notebook,
				filename: lookup.filename,
				type: ArtifactType.SNA
			});
			t.is(artifact.buf, 'Test File #1\n');
			return waitPromise(3, artifact);  // delay 3 seconds and return artifact
		})
		.then((artifact: Artifact) => {
			artifact.buf += 'Added Content';
			return adb;
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
			t.fail(err);
		});
});
