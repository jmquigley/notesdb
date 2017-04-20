'use strict';

import test from 'ava';
import * as fs from 'fs-extra';
import * as path from 'path';
import {Fixture} from 'util.fixture';
import {Artifact, NotesDB} from '../index';
import {ArtifactType} from '../lib/artifact';
import {cleanup, validateArtifact, validateDB} from './helpers';

test.after.always.cb(t => {
	cleanup(path.basename(__filename), t);
});

test('Try to get sections from an unitialized database', t => {
	const fixture = new Fixture('simple-db');
	const adb = new NotesDB({
		root: fixture.dir
	});

	adb.initialized = false;

	try {
		const sections = adb.sections();
		t.fail(sections.toString());
	} catch (err) {
		t.is(err.message, `Trying to retrieve sections from an unitialized database.`);
	}
});

test('Create a new section within an existing database', async t => {
	const fixture = new Fixture('simple-db');
	const adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const testArtifact = Artifact.factory('fields', {section: 'Test3'});
	t.truthy(testArtifact instanceof Artifact);

	await adb.add(testArtifact)
		.then((artifact: Artifact) => {
			validateArtifact(t, artifact, {
				section: 'Test3',
				type: ArtifactType.S
			});
			const sections = adb.sections();
			t.truthy(sections instanceof Array);
			t.is(sections.length, 5);

			const l = [
				'Default',
				'Test1',
				'Test2',
				'Test3',
				'Section With Spaces'
			];

			l.forEach((name: string) => {
				t.true(adb.hasSection({section: name}));
			});

			t.true(fs.existsSync(path.join(adb.config.dbdir, 'Test3')));
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(err);
		});
});

test('Try to create a section that already exists within a database (negative test)', async t => {
	const fixture = new Fixture('simple-db');
	const adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const testArtifact = Artifact.factory('fields', {
		section: 'Test1'
	});
	t.truthy(testArtifact instanceof Artifact);

	await adb.add(testArtifact)
		.then((artifact: Artifact) => {
			validateArtifact(t, artifact, {
				section: 'Test1',
				type: ArtifactType.S
			});
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(err);
		});
});

test('Try to create an artifact with bad section name (negative test)', async t => {
	const fixture = new Fixture('simple-db');
	const adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const badSectionName = '////badSectionName';
	const testArtifact = Artifact.factory('fields', {
		section: badSectionName
	});
	t.truthy(testArtifact instanceof Artifact);

	await adb.add(testArtifact)
		.then((artifact: Artifact) => {
			t.false(artifact.toString());
		})
		.catch((err: string) => {
			t.is(err, `Invalid section name '${badSectionName}'.  Can only use '-\\.+@_!$&0-9a-zA-Z '.`);
		});
});
