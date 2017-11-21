'use strict';

import test from 'ava';
import * as fs from 'fs-extra';
import * as path from 'path';
import {Fixture} from 'util.fixture';
import {waitPromise} from 'util.wait';
import {Artifact, Binder} from '../index';
import {ArtifactSearch, ArtifactType} from '../lib/artifact';
import {cleanup, validateArtifact, validateBinder} from './helpers';

test.after.always(async t => {
	await cleanup(path.basename(__filename), t);
});

test('Get an existing artifact from the schema', async t => {
	const fixture = new Fixture('simple-db');
	const adb = new Binder({
		root: fixture.dir
	});

	validateBinder(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const lookup: ArtifactSearch = {
		section: 'Default',
		notebook: 'Default',
		filename: 'test1.txt'
	};
	const metaPath: string = `${lookup.section}/${lookup.notebook}/${lookup.filename}`;

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

			const tags = artifact.tags;
			const l = ['A', 'B'];

			l.forEach((tag: string) => {
				t.true(tags.indexOf(tag) !== -1);
			});

			artifact.addTag('C');
			return adb;
		})
		.then(adb.shutdown)
		.then((msg: string) => {
			t.is(msg, 'The database is shutdown.');

			const metaFile = path.join(adb.config.configRoot, 'meta.json');
			const metadata = JSON.parse(fs.readFileSync(metaFile).toString());

			const l = ['A', 'B', 'C'];

			l.forEach((tag: string) => {
				t.true(metadata[metaPath].tags.indexOf(tag) !== -1);
			});
		})
		.catch((err: string) => {
			t.fail(err);
		});
});

test('Test artifact update time change after change', async t => {
	const fixture = new Fixture('simple-db');
	const adb = new Binder({
		root: fixture.dir
	});

	validateBinder(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const lookup: ArtifactSearch = {
		section: 'Default',
		notebook: 'Default',
		filename: 'test1.txt'
	};
	const before: string = JSON.stringify(adb.meta, null, '\t');
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
			const metaFile = path.join(adb.config.configRoot, 'meta.json');
			after = JSON.parse(fs.readFileSync(metaFile).toString());
			t.true(before !== after);

			const data: string = fs.readFileSync(path.join(adb.config.dbdir,
			lookup.section, lookup.notebook, lookup.filename)).toString();

			t.is(data, 'Test File #1\nAdded Content');
		})
		.catch((err: string) => {
			t.fail(err);
		});
});
