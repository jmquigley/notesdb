'use strict';

import {test} from 'ava';
import * as fs from 'fs-extra';
import * as path from 'path';
import {Artifact, IArtifactSearch} from '../lib/artifact';
import {Fixture} from 'util.fixture';
import {NotesDB} from '../lib/notesdb';
import {validateDB} from './helpers';

test.after.always((t: any) => {
	console.log('final cleanup: test_db_artifacts');
	let directories = Fixture.cleanup();
	directories.forEach((directory: string) => {
		t.false(fs.existsSync(directory));
	});
});

test('Create a new artifact file within the database', async(t: any) => {
	let fixture = new Fixture('simple-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let adb = new NotesDB({
		binderName: 'sampledb',
		configFile: configFile,
		root: fixture.dir
	});

	validateDB(adb, configFile, 'sampledb', fixture.dir, adb.initialized, t);

	let artifact = Artifact.factory('all', {
		section: 'Test3',
		notebook: 'notebook',
		filename: 'test file 1.txt'
	});

	await adb.add(artifact)
		.then(adb.save)
		.then((adb: NotesDB) => {
			t.pass(adb.toString());
			adb.shutdown();
		})
		.catch((err: string) => {
			t.fail(`${t.title}: ${err}`);
		});
});

test('Try to add an artifact with a bad name to the database (negative test)', async(t: any) => {
	let fixture = new Fixture('simple-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let adb = new NotesDB({
		binderName: 'sampledb',
		configFile: configFile,
		root: fixture.dir
	});

	validateDB(adb, configFile, 'sampledb', fixture.dir, adb.initialized, t);

	let badFileName = '////badfilename';
	let artifact = Artifact.factory('all', {
		section: 'Test3',
		notebook: 'notebook',
		filename: badFileName
	});

	await adb.add(artifact)
		.then((adb: NotesDB) => {
			t.fail(adb.toString());
		})
		.catch((err: string) => {
			t.is(err, `Invalid filename name '${badFileName}'.  Can only use '-\\.+@_!$&0-9a-zA-Z '.`);
			t.pass(err);
		});
});

test('Try to add a bad artifact to the database (negative test)', async(t: any) => {
	let fixture = new Fixture('simple-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let adb = new NotesDB({
		binderName: 'sampledb',
		configFile: configFile,
		root: fixture.dir
	});

	validateDB(adb, configFile, 'sampledb', fixture.dir, adb.initialized, t);

	let artifact = new Artifact();
	await adb.add(artifact)
		.then((adb: NotesDB) => {
			t.fail(adb.toString());
		})
		.catch((err: string) => {
			t.is(err, 'Trying to add invalid artifact to DB');
			t.pass(err);
		});

});

test.cb('Try to load a binder with a bad artifact name (negative test)', (t: any) => {
	let fixture = new Fixture('bad-db-artifact');
	let configFile = path.join(fixture.dir, 'config.json');
	let badFileName = '%%%%badfile.txt';

	try {
		let adb = new NotesDB({
			binderName: 'sampledb',
			configFile: configFile,
			root: fixture.dir
		});
		t.fail(adb.toString());
	} catch (err) {
		t.is(err.message, `Invalid filename name '${badFileName}'.  Can only use '-\\.+@_!$&0-9a-zA-Z '.`);
		t.pass(err.message);
	}

	t.end();
});

test('Get an existing artifact from the schema', async(t: any) => {
	let fixture = new Fixture('simple-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let adb = new NotesDB({
		binderName: 'sampledb',
		configFile: configFile,
		root: fixture.dir
	});

	validateDB(adb, configFile, 'sampledb', fixture.dir, adb.initialized, t);

	let lookup: IArtifactSearch = {
		section: 'Default',
		notebook: 'Default',
		filename: 'test1.txt'
	};

	await adb.get(lookup)
		.then((artifact: Artifact) => {
			t.is(artifact.buf, 'Test File #1\n');
			t.true(artifact.loaded);

			// Retrieve the same artifact again to show it's indepotent
			// (and loaded).  This return is fed to the next "thenable"
			return (adb.get(lookup));
		})
		.then((artifact: Artifact) => {
			t.is(artifact.buf, 'Test File #1\n');
			t.true(artifact.loaded);
		})
		.catch((err: string) => {
			t.fail(err);
		});
});

test(`Try to retrieve an artifact that doesn't exist`, async (t: any) => {
	let fixture = new Fixture('simple-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let adb = new NotesDB({
		binderName: 'sampledb',
		configFile: configFile,
		root: fixture.dir
	});

	validateDB(adb, configFile, 'sampledb', fixture.dir, adb.initialized, t);

	let lookup: IArtifactSearch = {
		section: 'Missing',
		notebook: 'Missing',
		filename: 'test1.txt'
	};

	await adb.get(lookup)
		.then((artifact: Artifact) => {
			t.fail(artifact.toString());
		})
		.catch((err: string) => {
			t.is(err, `Artifact doesn't exist: Missing|Missing|test1.txt`);
			t.pass(err);
		});
});