'use strict';

import {test} from 'ava';
import * as fs from 'fs-extra';
import * as _ from 'lodash';
import {Artifact} from '../index';
import {IArtifactSearch} from '../lib/artifact';
import {Fixture} from 'util.fixture';
import {NotesDB} from '../index';
import {validateDB, validateArtifact} from './helpers';

test.after.always((t: any) => {
	console.log('final cleanup: test_db_add');
	let directories = Fixture.cleanup();
	directories.forEach((directory: string) => {
		t.false(fs.existsSync(directory));
	});
});

test('Create a new artifact file within the database', async (t: any) => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	let artifact = {
		section: 'Test3',
		notebook: 'notebook',
		filename: 'test file 1.txt'
	};

	await adb.add(artifact)
		.then((artifact: Artifact) => {
			validateArtifact(artifact, 'Test3', 'notebook', 'test file 1.txt', t);
			return adb.saveArtifact(artifact);
		})
		.then((artifact: Artifact) => {
			t.pass(artifact.toString());
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(`${t.title}: ${err}`);
		});
});

test('Try to add an artifact with a bad name to the database (negative test)', async (t: any) => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	let badFileName = '////badfilename';
	let artifact = {
		section: 'Test3',
		notebook: 'notebook',
		filename: badFileName
	};

	await adb.add(artifact)
		.then((artifact: Artifact) => {
			t.fail(artifact.toString());
		})
		.catch((err: string) => {
			t.is(err, `Invalid filename name '${badFileName}'.  Can only use '-\\.+@_!$&0-9a-zA-Z '.`);
			t.pass(err);
		});
});

test('Try to add a bad artifact to the database (negative test)', async (t: any) => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	let artifact = Artifact.factory();
	artifact.type = 99;  // set an invalid type to force failure

	await adb.add(artifact)
		.then((artifact: Artifact) => {
			t.fail(artifact.toString());
		})
		.catch((err: string) => {
			t.is(err, 'Trying to add invalid artifact to DB');
			t.pass(err);
		});
});

test('Try to create a null artifact (negative test)', async (t: any) => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	await adb.add(null)
		.then((artifact: Artifact) => {
			t.fail(artifact.toString());
		})
		.catch((err: string) => {
			t.is(err, 'Trying to add invalid artifact to DB');
			t.pass(err);
		});
});

test.cb('Try to load a binder with a bad artifact name (negative test)', (t: any) => {
	let fixture = new Fixture('bad-db-artifact');
	let badFileName = '%%%%badfile.txt';

	try {
		let adb = new NotesDB({
			binderName: 'sampledb',
			root: fixture.dir
		});
		t.fail(adb.toString());
	} catch (err) {
		t.is(err.message, `Invalid filename name '${badFileName}'.  Can only use '-\\.+@_!$&0-9a-zA-Z '.`);
		t.pass(err.message);
	}

	t.end();
});

test('Get an existing artifact from the schema', async (t: any) => {
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

	await adb.get(lookup)
		.then((artifact: Artifact) => {
			t.is(artifact.buf, 'Test File #1\n');
			t.true(artifact.loaded);

			// Retrieve the same artifact again to show it's indepotent
			// (and loaded).  This return is fed to the next "thenable"
			return adb.get(lookup);
		})
		.then((artifact: Artifact) => {
			t.is(artifact.buf, 'Test File #1\n');
			t.true(artifact.loaded);
			return adb
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(`${t.title}: ${err}`);
		});
});

test(`Try to retrieve an artifact that doesn't exist`, async (t: any) => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

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

test('Create a new artifact, update it, and call the save', async (t: any) => {
	let fixture = new Fixture('empty-db');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	let artifact = {
		section: 'Test1',
		notebook: 'notebook1',
		filename: 'somefile.txt'
	};

	let content: string = 'Adding content';
	await adb.add(artifact)
		.then((artifact: Artifact) => {
			t.false(artifact.isDirty());
			artifact.buf += content;
			t.true(artifact.isDirty());
			return artifact;
		})
		.then(adb.saveArtifact)
		.then((artifact: Artifact) => {
			let data: string = fs.readFileSync(artifact.absolute()).toString();
			t.is(data, content);

			t.false(artifact.isDirty());
			artifact.buf += content;
			t.true(artifact.isDirty());
			return artifact;
		})
		.then(adb.saveArtifact)
		.then((artifact: Artifact) => {
			let data: string = fs.readFileSync(artifact.absolute()).toString();
			t.is(data, `${content}${content}`);
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(`${t.title}: ${err}`);
		});
});

test('Test the automatic ejection from recents list', async (t: any) => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir,
		maxRecents: 1 // make the recents small
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	let ejected: Artifact = null;

	await adb.get({section: 'Default', notebook: 'Default', filename: 'test1.txt'})
		.then((artifact: Artifact) => {
			validateArtifact(artifact, 'Default', 'Default', 'test1.txt', t);

			ejected = artifact;
			t.false(artifact.isDirty());
			artifact.buf += 'Content change';
			t.true(artifact.isDirty());

			// This call should eject the first file from recents and save it.
			return adb.get({section: 'Default', notebook: 'notebook1', filename: 'test2.txt'});
		})
		.then((artifact: Artifact) => {
			validateArtifact(artifact, 'Default', 'notebook1', 'test2.txt', t);

			// wasting time for event fire from first ejected to work
			let promise = null;
			_.times(10, () => {
				promise = adb.get({section: 'Test1', notebook: 'Default', filename: 'test3.txt'})
			});
			return promise;
		})
		.then((artifact: Artifact) => {
			validateArtifact(artifact, 'Test1', 'Default', 'test3.txt', t);
			return adb;
		})
		.then((adb: NotesDB) => {
			t.is(adb.recents.length, 1);
			t.false(ejected.isDirty());
			let data: string = fs.readFileSync(ejected.absolute()).toString();
			t.is(data, 'Test File #1\nContent change');
			t.is(ejected.buf, data);
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(`${t.title}: ${err}`);
		});
});
