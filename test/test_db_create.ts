'use strict';

import test from 'ava';
import * as fs from 'fs-extra';
import * as path from 'path';
import {Fixture} from 'util.fixture';
import {waitPromise} from 'util.wait';
import * as uuid from 'uuid';
import {Artifact, NotesDB} from '../index';
import {IArtifactSearch} from '../lib/artifact';
import {cleanup, validateDB} from './helpers';

const pkg = require('../package.json');

test.after.always.cb(t => {
	cleanup(path.basename(__filename), t);
});

test('The database toString() function', t => {
	const fixture = new Fixture('empty-db');
	const adb = new NotesDB({
		binderName: 'sampledb',
		configRoot: fixture.dir,
		root: fixture.dir
	});

	validateDB(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const s = adb.toString();
	t.is(typeof s, 'string');

	if (pkg.debug) {
		console.log(s);
	}
});

test('Create a new database with a custom configuration', t => {
	const fixture = new Fixture();
	const dir = path.join(fixture.dir, uuid.v4());
	const adb = new NotesDB({
		root: dir
	});

	validateDB(t, adb, 'adb', dir, adb.initialized);
	t.pass();
});

test('Create an initial binder', async t => {
	const fixture = new Fixture('empty-db');
	const notesDB = new NotesDB({
		root: fixture.dir
	});

	validateDB(t, notesDB, 'sampledb', fixture.dir, notesDB.initialized);

	await notesDB.create(['Test1', 'Test2'])
		.then((adb: NotesDB) => {
			const sections = adb.sections();
			const l = [
				'Default',
				'Test1',
				'Test2',
				'Trash'
			];

			t.is(sections.length, 4);
			sections.forEach((section: string) => {
				t.true(l.indexOf(section) > -1);
			});

			return adb;
		})
		.then(notesDB.shutdown)
		.catch((err: string) => {
			t.fail(err);
		});
});

test('Create an initial binder with empty schema', async t => {
	const fixture = new Fixture('empty-db');
	const notesDB = new NotesDB({
		root: fixture.dir
	});

	validateDB(t, notesDB, 'sampledb', fixture.dir, notesDB.initialized);
	await notesDB.create([])
		.then((adb: NotesDB) => {
			t.true(adb.hasSection({section: 'Default'}));
			return adb;
		})
		.then(notesDB.shutdown)
		.catch((err: string) => {
			t.fail(err);
		});
});

test('Try to create a binder with a bad name (negative test)', t => {
	const fixture = new Fixture('tmpdir');
	const binderName: string = '////testdb';

	try {
		const adb = new NotesDB({
			binderName: binderName,
			root: fixture.dir
		});
		t.fail(adb.toString());
	} catch (err) {
		t.is(err.message, `Invalid binder name '${binderName}'.  Can only use '-\\.+@_!$&0-9a-zA-Z '.`);
	}
});

test('Create a binder with a bad initial section name', async t => {
	const fixture = new Fixture('empty-db');
	const notesDB = new NotesDB({
		root: fixture.dir
	});
	const binderName: string = '////Test1';

	validateDB(t, notesDB, 'sampledb', fixture.dir, notesDB.initialized);

	await notesDB.create(binderName)
		.then((adb: NotesDB) => {
			t.fail(adb.toString());
		})
		.catch((err: string) => {
			t.is(err, `Invalid section name '${binderName}'.  Can only use '-\\.+@_!$&0-9a-zA-Z '.`);
		});
});

test('Open existing database with defaultConfigFile location', async t => {
	const fixture = new Fixture('simple-db');
	const adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(t, adb, 'sampledb', fixture.dir, adb.initialized);

	// Check for sections
	t.true(adb.hasSection({section: 'Default'}));
	t.true(adb.hasSection({section: 'Test1'}));
	t.true(adb.hasSection({section: 'Test2'}));

	// Check for notebooks
	t.true(adb.hasNotebook({notebook: 'Default', section: 'Default'}));
	t.true(adb.hasNotebook({notebook: 'notebook1', section: 'Default'}));
	t.true(adb.hasNotebook({notebook: 'Default', section: 'Test1'}));
	t.true(adb.hasNotebook({notebook: 'Default', section: 'Test2'}));

	// Check for artifacts within notebooks
	let artifact = Artifact.factory('fields', {
		section: 'Default',
		notebook: 'Default',
		filename: 'test1.txt'
	});
	t.true(adb.hasArtifact(artifact));

	artifact = Artifact.factory('fields', {
		section: 'Default',
		notebook: 'notebook1',
		filename: 'test2.txt'
	});
	t.true(adb.hasArtifact(artifact));

	artifact = Artifact.factory('fields', {
		section: 'Test1',
		notebook: 'Default',
		filename: 'test3.txt'
	});
	t.true(adb.hasArtifact(artifact));

	artifact = Artifact.factory('fields', {
		section: 'Test2',
		notebook: 'Default',
		filename: 'test4.txt'
	});
	t.true(adb.hasArtifact(artifact));

	await adb.shutdown()
		.then((msg: string) => {
			t.is(msg, 'The database is shutdown.');
		})
		.catch((err: string) => {
			t.fail(err);
		});
});

test('Try to load existing database with missing config file (negative test)', t => {
	const fixture = new Fixture('missing-db-config');

	try {
		const adb = new NotesDB({
			root: fixture.dir
		});
		t.fail(adb.toString());
	} catch (err) {
		t.is(err.message, `Can't find notesdb configuration: badconfigfile.`);
	}
});

test('Try to load existing database with missing root directory (negative test)', t => {
	const fixture = new Fixture('missing-db-root');

	try {
		const adb = new NotesDB({
			root: fixture.dir
		});
		t.fail(adb.toString());
	} catch (err) {
		t.is(err.message, `No notesdb located @ badrootdirsampledb.`);
	}
});

test('Try to create a database with a missing dbdir in the config (negative test)', t => {
	const fixture = new Fixture('missing-db-dbdir');

	try {
		const adb = new NotesDB({
			root: fixture.dir
		});
		t.fail(adb.toString());
	} catch (err) {
		t.is(err.message, `The database directory is missing from configuration.`);
	}
});

test('Test trying to save a bad configuration file (negative test)', async t => {
	const fixture = new Fixture('simple-db');
	const adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(t, adb, 'sampledb', fixture.dir, adb.initialized);
	adb.config.configFile = '';  // destroy config reference

	await adb.save()
		.then((padb: NotesDB) => {
			t.fail(padb.toString());
		})
		.catch((err: string) => {
			t.is(err, `ENOENT: no such file or directory, open ''`);
		});
});

test('Test trying to save a bad metadata file (negative test)', async t => {
	const fixture = new Fixture('simple-db');
	const adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(t, adb, 'sampledb', fixture.dir, adb.initialized);
	adb.config.metaFile = '';  // destroy config reference

	await adb.save()
		.then((padb: NotesDB) => {
			t.fail(padb.toString());
		})
		.catch((err: string) => {
			t.is(err, `ENOENT: no such file or directory, open ''`);
		});
});

test('Test the timed save facility', async t => {
	const fixture = new Fixture('simple-db');
	const adb = new NotesDB({
		root: fixture.dir,
		saveInterval: 1000
	});

	validateDB(t, adb, 'sampledb', fixture.dir, adb.initialized);

	await waitPromise(5)
		.then(() => {
			t.true(adb.timedSave);
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(err);
		});
});

test('Test the reload function', async t => {
	const fixture = new Fixture('simple-db');
	const adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const filename = 'outside.txt';
	const data = 'Test outside data file';
	const lookup: IArtifactSearch = {
		section: 'Default',
		notebook: 'Default',
		filename: filename
	};

	t.true(adb.initialized);
	t.false(adb.hasArtifact(lookup));

	fs.writeFileSync(path.join(adb.config.dbdir, 'Default', 'Default', filename), data);

	await adb.reload()
		.then((padb: NotesDB) => {
			t.true(padb.hasArtifact(lookup));
			return padb.get(lookup);
		})
		.then((artifact: Artifact) => {
			t.is(artifact.buf, data);
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(err);
		});
});

test('Try to add an empty item to an existing database', async t => {
	const fixture = new Fixture('simple-db');
	const adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(t, adb, 'sampledb', fixture.dir, adb.initialized);

	await adb.add({})
		.then((artifact: Artifact) => {
			t.fail(artifact.toString());
		})
		.catch((err: string) => {
			t.is(err, 'Trying to add invalid artifact to DB');
		});
});

test('Test has functions for NotesDB', t => {
	const fixture = new Fixture('simple-db');
	const adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(t, adb, 'sampledb', fixture.dir, adb.initialized);

	// Successful tests
	t.true(adb.hasSection({section: 'Test1'}));
	t.true(adb.hasNotebook({section: 'Test1', notebook: 'Default'}));
	t.true(adb.hasArtifact({section: 'Test1', notebook: 'Default', filename: 'test3.txt'}));

	// Failure tests
	t.false(adb.hasSection({section: 'blah'}));
	t.false(adb.hasSection({section: 'blah'}, 'badarea'));
	t.false(adb.hasNotebook({section: 'Test1', notebook: 'blah'}));
	t.false(adb.hasNotebook({section: 'blah', notebook: 'blah'}));
	t.false(adb.hasArtifact({section: 'Test1', notebook: 'Default', filename: 'blah.txt'}));
	t.false(adb.hasArtifact({section: 'Test1', notebook: 'blah', filename: 'blah.txt'}));
	t.false(adb.hasArtifact({section: 'blah', notebook: 'blah', filename: 'blah.txt'}));
});

test('Test simple database with additional ignored directories', t => {
	const fixture = new Fixture('simple-db-with-ignored');
	const adb = new NotesDB({
		root: fixture.dir,
		ignore: ['Attachments', 'Images']
	});
	const l: string[] = ['Test1', 'Test2'];

	const sections: string[] = adb.sections();
	t.is(sections.length, 2);
	for (const section of sections) {
		t.true(l.indexOf(section) !== -1);
	}

	t.true(fs.existsSync(path.join(adb.config.dbdir, 'Attachments')));
	t.true(fs.existsSync(path.join(adb.config.dbdir, 'Images')));
	t.true(fs.existsSync(path.join(adb.config.dbdir, 'Test1')));
	t.true(fs.existsSync(path.join(adb.config.dbdir, 'Test2')));
});
