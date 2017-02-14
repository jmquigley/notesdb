'use strict';

import {CallbackTestContext, test, TestContext} from 'ava';
import * as fs from 'fs-extra';
import * as path from 'path';
import {Fixture} from 'util.fixture';
import * as uuid from 'uuid';
import {Artifact} from '../lib/artifact';
import {NotesDB} from '../lib/notesdb';
import {validateDB} from './helpers';

const randomBytes = require('randombytes');
const pkg = require('../package.json');

test.after.always((t: TestContext) => {
	console.log('final cleanup: test_db_create');
	let directories = Fixture.cleanup();
	directories.forEach((directory: string) => {
		t.false(fs.existsSync(directory));
	});
});

test.cb('The database toString() function', (t: CallbackTestContext) => {
	let fixture = new Fixture('empty-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let adb = new NotesDB({
		binderName: 'sampledb',
		configFile: configFile,
		root: fixture.dir
	});

	validateDB(adb, configFile, 'sampledb', fixture.dir, adb.initialized, t);

	let s = adb.toString();
	t.true(typeof s === 'string');

	if (pkg.debug) {
		console.log(s);
	}
	adb.shutdown();
	t.end();
});

test.cb('Create a new database with a custom configuration', (t: CallbackTestContext) => {
	let fixture = new Fixture();
	let dir = path.join(fixture.dir, uuid.v4());
	let configFile = path.join(dir, 'config.json');
	let adb = new NotesDB({
		configFile: configFile,
		root: dir
	});

	validateDB(adb, configFile, 'adb', dir, adb.initialized, t);
	adb.shutdown();
	t.end();
});

test('Create an initial binder', async (t: TestContext) => {
	let fixture = new Fixture('empty-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let notesDB = new NotesDB({
		configFile: configFile
	});

	validateDB(notesDB, configFile, 'sampledb', fixture.dir, notesDB.initialized, t);

	await notesDB.create([
		'Test1',
		'Test2'
	])
		.then((adb: NotesDB) => {
			let sections = adb.sections();
			let l = [
				'Default',
				'Test1',
				'Test2'
			];

			sections.forEach((section: string) => {
				t.true(l.indexOf(section) > -1);
			});

			notesDB.shutdown();
		})
		.catch((err: string) => {
			t.fail(`${this.name}: ${err}`);
		});
});

test('Create an initial binder with empty schema', async (t: TestContext) => {
	let fixture = new Fixture('empty-db');

	let configFile = path.join(fixture.dir, 'config.json');
	let notesDB = new NotesDB({
		configFile: configFile
	});

	validateDB(notesDB, configFile, 'sampledb', fixture.dir, notesDB.initialized, t);
	await notesDB.create([])
		.then((adb: NotesDB) => {
			t.true(adb.hasSection('Default'));
			notesDB.shutdown();
		})
		.catch((err: string) => {
			t.fail(`${this.name}: ${err}`);
		});
});

test.cb('Try to create a binder with a bad name (negative test)', (t: CallbackTestContext) => {
	let fixture = new Fixture('tmpdir');
	let configFile = path.join(fixture.dir, 'config.json');
	let binderName:string = '////testdb';

	try {
		let adb = new NotesDB({
			configFile: configFile,
			binderName: binderName
		});
		t.fail(adb.toString());
	} catch (err) {
		t.is(err.message, `Invalid binder name '${binderName}'.  Can only use '-\\.+@_0-9a-zA-Z '.`);
		t.pass(err.message);
	}
	t.end();
});

test('Create a binder with a bad initial section name', async (t: TestContext) => {
	let fixture = new Fixture('empty-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let notesDB = new NotesDB({
		configFile: configFile
	});
	let binderName: string = '////Test1';

	validateDB(notesDB, configFile, 'sampledb', fixture.dir, notesDB.initialized, t);

	await notesDB.create(binderName)
		.then((adb: NotesDB) => {
			t.fail(adb.toString());
		})
		.catch((err: string) => {
			t.is(err, `Invalid section name '${binderName}'.  Can only use '-\\.+@_0-9a-zA-Z '.`);
			t.pass(err);
		});
});

test.cb('Open existing database with defaultConfigFile location', (t: CallbackTestContext) => {
	let fixture = new Fixture('simple-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let adb = new NotesDB({
		configFile: configFile
	});

	validateDB(adb, configFile, 'sampledb', fixture.dir, adb.initialized, t);

	// Check for sections
	t.true(adb.hasSection('Default'));
	t.true(adb.hasSection('Test1'));
	t.true(adb.hasSection('Test2'));

	// Check for notebooks
	t.true(adb.hasNotebook('Default', 'Default'));
	t.true(adb.hasNotebook('notebook1', 'Default'));
	t.true(adb.hasNotebook('Default', 'Test1'));
	t.true(adb.hasNotebook('Default', 'Test2'));

	// Check for artifacts within notebooks
	let artifact = Artifact.factory('all', {
		section: 'Default',
		notebook: 'Default',
		filename: 'test1.txt'
	});
	t.true(adb.hasArtifact(artifact));

	artifact = Artifact.factory('all', {
		section: 'Default',
		notebook: 'notebook1',
		filename: 'test2.txt'
	});
	t.true(adb.hasArtifact(artifact));

	artifact = Artifact.factory('all', {
		section: 'Test1',
		notebook: 'Default',
		filename: 'test3.txt'
	});
	t.true(adb.hasArtifact(artifact));

	artifact = Artifact.factory('all', {
		section: 'Test2',
		notebook: 'Default',
		filename: 'test4.txt'
	});
	t.true(adb.hasArtifact(artifact));

	adb.shutdown();
	t.end();
});

test.cb('Try to load existing database with missing config file', (t: CallbackTestContext) => {
	let fixture = new Fixture('missing-db-config');
	let configFile = path.join(fixture.dir, 'config.json');

	try {
		let adb = new NotesDB({
			configFile: configFile
		});
		t.fail(adb.toString());
	} catch (err) {
		t.is(err.message, `Can't find notesdb configuration: badconfigfile.`);
		t.pass(err.message);
	}
	t.end();
});

test.cb('Try to load existing database with missing root directory', (t: CallbackTestContext) => {
	let fixture = new Fixture('missing-db-root');
	let configFile = path.join(fixture.dir, 'config.json');

	try {
		let adb = new NotesDB({
			configFile: configFile
		});
		t.fail(adb.toString());
	} catch (err) {
		t.is(err.message, `No notesdb located @ badrootdirsampledb.`);
		t.pass(err.message);
	}
	t.end();
});

test.cb('Try to create a database with a missing dbdir in the config', (t: CallbackTestContext) => {
	let fixture = new Fixture('missing-db-dbdir');
	let configFile = path.join(fixture.dir, 'config.json');

	try {
		let adb = new NotesDB({
			configFile: configFile
		});
		t.fail(adb.toString());
	} catch (err) {
		t.is(err.message, `The database directory is missing from configuration.`);
		t.pass(err.message);
	}
	t.end();
});

test('Test trying to save a bad configuration file', async (t: TestContext) => {
	let fixture = new Fixture('simple-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let adb = new NotesDB({
		configFile: configFile
	});

	validateDB(adb, configFile, 'sampledb', fixture.dir, adb.initialized, t);
	adb.config.configFile = '';  // destroy config refernce

	await adb.save()
		.then(adb => {
			t.fail(adb.toString());
		})
		.catch(err => {
			t.is(err, `ENOENT: no such file or directory, open ''`);
			t.pass(err.message);
		});
});

test.cb('Test the timed save facility', (t: CallbackTestContext) => {

	// This is a really ugly timed save facility test.  It wastes time by
	// creating N files async.  When the N files are complete it checks a
	// global counter to see that they are all done.  When this global counter
	// is exceeded, then the test is ended.  When it ends, the timed save
	// facility should have fired (and saved a flag within the DB).
	//
	// The files are created by inserting random bytes into randoml named
	// files within the fixture.

	let fixture = new Fixture('simple-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let notesDB = new NotesDB({
		configFile: configFile,
		saveInterval: 100
	});

	validateDB(notesDB, configFile, 'sampledb', fixture.dir, notesDB.initialized, t);

	let numFiles = 20;
	let counter = 0;

	let fn = function() {
		let out = path.join(fixture.dir, `${uuid.v4()}.txt`);
		fs.writeFile(out, randomBytes(5 * 1024 * 1024), (err) => {
			if (err) {
				t.fail(err.message);
			}

			console.log(`Done[${counter}]: ${out}`);

			if (counter++ >= numFiles-1) {
				t.true(notesDB.timedSave);
				notesDB.shutdown();
				t.end();
			}
		});
	};

	for (let i=0; i<numFiles; i++) {
		fn();
	}
});
