'use strict';

import test from 'ava';
import * as fs from 'fs-extra';
import * as path from 'path';
import {Fixture} from 'util.fixture';
import {waitPromise} from 'util.wait';
import {Artifact, Binder} from '../index';
import {ArtifactType, IArtifactSearch} from '../lib/artifact';
import {cleanup, validateArtifact, validateBinder} from './helpers';

test.after.always.cb(t => {
	cleanup(path.basename(__filename), t);
});

test('Create a new artifact file within the database', async t => {
	const fixture = new Fixture('simple-db');
	const adb = new Binder({
		root: fixture.dir
	});

	validateBinder(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const testArtifact = {
		section: 'Test3',
		notebook: 'notebook',
		filename: 'test file 1.txt'
	};

	await adb.add(testArtifact)
		.then((artifact: Artifact) => {
			validateArtifact(t, artifact, {
				section: 'Test3',
				notebook: 'notebook',
				filename: 'test file 1.txt',
				type: ArtifactType.SNA
			});
			return adb.saveArtifact(artifact);
		})
		.then((artifact: Artifact) => {
			t.truthy(artifact.toString());
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(err);
		});
});

test('Try to add an artifact with a bad name to the database (negative test)', async t => {
	const fixture = new Fixture('simple-db');
	const adb = new Binder({
		root: fixture.dir
	});

	validateBinder(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const badFileName = '////badfilename';
	const testArtifact = {
		section: 'Test3',
		notebook: 'notebook',
		filename: badFileName
	};

	await adb.add(testArtifact)
		.then((artifact: Artifact) => {
			t.fail(artifact.toString());
		})
		.catch((err: string) => {
			t.is(err, `Invalid filename name '${badFileName}'.  Can only use '-\\.+@_!$&0-9a-zA-Z '.`);
		});
});

test('Try to add a bad artifact to the database (negative test)', async t => {
	const fixture = new Fixture('simple-db');
	const adb = new Binder({
		root: fixture.dir
	});

	validateBinder(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const testArtifact = Artifact.factory();
	testArtifact.type = 99;  // set an invalid type to force failure

	await adb.add(testArtifact)
		.then((artifact: Artifact) => {
			t.fail(artifact.toString());
		})
		.catch((err: string) => {
			t.is(err, 'Trying to add invalid artifact to DB');
		});
});

test('Try to create a null artifact (negative test)', async t => {
	const fixture = new Fixture('simple-db');
	const adb = new Binder({
		root: fixture.dir
	});

	validateBinder(t, adb, 'sampledb', fixture.dir, adb.initialized);

	await adb.add(null)
		.then((artifact: Artifact) => {
			t.fail(artifact.toString());
		})
		.catch((err: string) => {
			t.is(err, 'Trying to add invalid artifact to DB');
		});
});

test('Try to load a binder with a bad artifact name (negative test)', t => {
	const fixture = new Fixture('bad-db-artifact');
	const badFileName = '%%%%badfile.txt';

	try {
		const adb = new Binder({
			binderName: 'sampledb',
			root: fixture.dir
		});
		t.fail(adb.toString());
	} catch (err) {
		t.is(err.message, `Invalid filename name '${badFileName}'.  Can only use '-\\.+@_!$&0-9a-zA-Z '.`);
	}
});

test('Get an existing artifact from the schema', async t => {
	const fixture = new Fixture('simple-db');
	const adb = new Binder({
		root: fixture.dir
	});

	validateBinder(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const lookup: IArtifactSearch = {
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
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(err);
		});
});

test(`Try to retrieve an artifact that doesn't exist`, async t => {
	const fixture = new Fixture('simple-db');
	const adb = new Binder({
		root: fixture.dir
	});

	validateBinder(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const lookup: IArtifactSearch = {
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
		});
});

test('Create a new artifact, update it, and call the save', async t => {
	const fixture = new Fixture('empty-db');
	const adb = new Binder({
		root: fixture.dir
	});

	validateBinder(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const testArtifact = {
		section: 'Test1',
		notebook: 'notebook1',
		filename: 'somefile.txt'
	};

	const content: string = 'Adding content';
	await adb.add(testArtifact)
		.then((artifact: Artifact) => {
			t.false(artifact.isDirty());
			artifact.buf += content;
			t.true(artifact.isDirty());
			return artifact;
		})
		.then(adb.saveArtifact)
		.then((artifact: Artifact) => {
			const data: string = fs.readFileSync(artifact.absolute()).toString();
			t.is(data, content);

			t.false(artifact.isDirty());
			artifact.buf += content;
			t.true(artifact.isDirty());
			return artifact;
		})
		.then(adb.saveArtifact)
		.then((artifact: Artifact) => {
			const data: string = fs.readFileSync(artifact.absolute()).toString();
			t.is(data, `${content}${content}`);
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(err);
		});
});

test('Test the automatic ejection from recents list', async t => {
	const fixture = new Fixture('simple-db');
	const adb = new Binder({
		root: fixture.dir,
		maxRecents: 1 // make the recents small
	});

	validateBinder(t, adb, 'sampledb', fixture.dir, adb.initialized);

	let ejected: Artifact = null;

	await adb.get({section: 'Default', notebook: 'Default', filename: 'test1.txt'})
		.then((artifact: Artifact) => {
			validateArtifact(t, artifact, {
				section: 'Default',
				notebook: 'Default',
				filename: 'test1.txt',
				type: ArtifactType.SNA
			});

			ejected = artifact;
			t.false(artifact.isDirty());
			artifact.buf += 'Content change';
			t.true(artifact.isDirty());

			// This call should eject the first file from recents and save it.
			return adb.get({section: 'Default', notebook: 'notebook1', filename: 'test2.txt'});
		})
		.then((artifact: Artifact) => {
			validateArtifact(t, artifact, {
				section: 'Default',
				notebook: 'notebook1',
				filename: 'test2.txt',
				type: ArtifactType.SNA
			});

			// This wait allows the event loop to continue and process the
			// remove node event before moving on to the next thenable
			return waitPromise(3, adb.get({section: 'Test1', notebook: 'Default', filename: 'test3.txt'}));
		})
		.then((artifact: Artifact) => {
			validateArtifact(t, artifact, {
				section: 'Test1',
				notebook: 'Default',
				filename: 'test3.txt',
				type: ArtifactType.SNA
			});
			return adb;
		})
		.then((padb: Binder) => {
			t.is(padb.recents.length, 1);
			t.false(ejected.isDirty());
			const data: string = fs.readFileSync(ejected.absolute()).toString();
			t.is(data, 'Test File #1\nContent change');
			t.is(ejected.buf, data);
			return padb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(err);
		});
});
