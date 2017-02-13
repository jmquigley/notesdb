'use strict';

import {CallbackTestContext, test, TestContext} from 'ava';
import * as fs from 'fs-extra';
import * as path from 'path';
import {Artifact} from '../lib/artifact';
import {NotesDB} from '../lib/notesdb';
import {validateDB} from './helpers';

const Fixture = require('util.fixture');
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
	let notesDB = new NotesDB({
		binderName: 'sampledb',
		configFile: configFile,
		root: fixture.dir,
	});

	validateDB(notesDB, configFile, 'sampledb', fixture.dir, notesDB.initialized, fixture, t);

	let s = notesDB.toString();
	t.true(typeof s === 'string');

	if (pkg.debug) {
		console.log(s);
	}
	t.end();
});

test.cb('Create a new database with a custom configuration', (t: CallbackTestContext) => {
	let fixture = new Fixture('tmpdir');
	let configFile = path.join(fixture.dir, 'config.json');
	let adb = new NotesDB({
		configFile: configFile,
		root: fixture.dir,
	});

	validateDB(adb, configFile, 'adb', fixture.dir, adb.initialized, fixture, t);
	t.end();
});

test('Create an initial binder', async (t: TestContext) => {
	let fixture = new Fixture('empty-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let notesDB = new NotesDB({
		configFile: configFile,
	});

	validateDB(notesDB, configFile, 'sampledb', fixture.dir, notesDB.initialized, fixture, t);

	await notesDB.create([
		'Test1',
		'Test2',
	])
		.then((adb: NotesDB) => {
			let sections = adb.sections();
			let l = [
				'Default',
				'Test1',
				'Test2',
			];

			sections.forEach((section: string) => {
				t.true(l.indexOf(section) > -1);
			});
		})
		.catch((err: string) => {
			t.fail(`${this.name}: ${err}`);
		});
});

test.cb('Try to create a binder with a bad name (negative test)', (t: CallbackTestContext) => {
	let fixture = new Fixture('tmpdir');
	let configFile = path.join(fixture.dir, 'config.json');

	try {
		let adb = new NotesDB({
			configFile: configFile,
			binderName: '////testdb',
		});
		t.fail(adb.toString());
	} catch (err) {
		t.is(err.message, `Invalid binder name '////testdb'.  Can only use '-\\.+@_0-9a-zA-Z '.`);
		t.pass(err.message);
	}
	t.end();
});

test('Create a binder with a bad initial section name', async (t: TestContext) => {
	let fixture = new Fixture('empty-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let notesDB = new NotesDB({
		configFile: configFile,
	});

	validateDB(notesDB, configFile, 'sampledb', fixture.dir, notesDB.initialized, fixture, t);

	await notesDB.create('////Test1')
		.then((adb: NotesDB) => {
			t.fail(adb.toString());
		})
		.catch((err: string) => {
			t.is(err, `Invalid section name '////Test1'.  Can only use '-\\.+@_0-9a-zA-Z '.`);
			t.pass(err);
		});
});

test.cb('Open existing database with defaultConfigFile location', (t: CallbackTestContext) => {
	let fixture = new Fixture('simple-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let adb = new NotesDB({
		configFile: configFile,
	});

	validateDB(adb, configFile, 'sampledb', fixture.dir, adb.initialized, fixture, t);

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
		filename: 'test1.txt',
	});
	t.true(adb.hasArtifact(artifact));

	artifact = Artifact.factory('all', {
		section: 'Default',
		notebook: 'notebook1',
		filename: 'test2.txt',
	});
	t.true(adb.hasArtifact(artifact));

	artifact = Artifact.factory('all', {
		section: 'Test1',
		notebook: 'Default',
		filename: 'test3.txt',
	});
	t.true(adb.hasArtifact(artifact));

	artifact = Artifact.factory('all', {
		section: 'Test2',
		notebook: 'Default',
		filename: 'test4.txt',
	});
	t.true(adb.hasArtifact(artifact));

	t.end();
});

test.cb('Try to load existing database with missing config file', (t: CallbackTestContext) => {
	let fixture = new Fixture('missing-db-config');
	let configFile = path.join(fixture.dir, 'config.json');

	try {
		let adb = new NotesDB({
			configFile: configFile,
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
			configFile: configFile,
		});
		t.fail(adb.toString());
	} catch (err) {
		t.is(err.message, `No notesdb located @ badrootdirsampledb.`);
		t.pass(err.message);
	}
	t.end();
});

test.cb('Try to get sections from an unitialized database', (t: CallbackTestContext) => {
	let fixture = new Fixture('simple-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let adb = new NotesDB({
		configFile: configFile,
	});

	adb.initialized = false;

	try {
		let sections = adb.sections();
		t.fail(sections.toString());
	} catch (err) {
		t.is(err.message, `Trying to retrieve sections from an unitialized database.`);
		t.pass(err.message);
	}
	t.end();
});

test('Create a new section within an existing database', async (t: TestContext) => {
	let fixture = new Fixture('simple-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let notesDB = new NotesDB({
		configFile: configFile,
	});

	validateDB(notesDB, configFile, 'sampledb', fixture.dir, notesDB.initialized, fixture, t);

	let artifact = Artifact.factory('all', {section: 'Test3'});
	t.true(artifact instanceof Artifact);

	await notesDB.add(artifact)
		.then((adb: NotesDB) => {
			let sections = adb.sections();
			t.true(sections instanceof Array);
			t.is(sections.length, 4);

			let l = [
				'Default',
				'Test1',
				'Test2',
				'Test3',
			];

			l.forEach((name: string) => {
				t.true(adb.hasSection(name));
			});

			t.true(fs.existsSync(path.join(adb.config.dbdir, 'Test3')));
		})
		.catch((err: string) => {
			t.fail(`${this.name}: ${err}`);
		});
});

test('Try to create an artifact with bad section name (negative test)', async (t: TestContext) => {
	let fixture = new Fixture('simple-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let notesDB = new NotesDB({
		configFile: configFile,
	});

	validateDB(notesDB, configFile, 'sampledb', fixture.dir, notesDB.initialized, fixture, t);

	let artifact = Artifact.factory('all', {
		section: '////badSectionName',
	});
	t.true(artifact instanceof Artifact);

	await notesDB.add(artifact)
		.then((adb: NotesDB) => {
			t.fail(adb.toString());
		})
		.catch((err: string) => {
			t.is(err, `Invalid section name '////badSectionName'.  Can only use '-\\.+@_0-9a-zA-Z '.`);
			t.pass(err);
		});
});

test('Try to create a section that already exists within a database', async (t: TestContext) => {
	let fixture = new Fixture('simple-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let notesDB = new NotesDB({
		configFile: configFile,
	});

	validateDB(notesDB, configFile, 'sampledb', fixture.dir, notesDB.initialized, fixture, t);

	let artifact = Artifact.factory('all', {
		section: 'Test1',
	});
	t.true(artifact instanceof Artifact);

	await notesDB.add(artifact)
		.then((adb: NotesDB) => {
			t.pass(adb.toString());
		})
		.catch((err: string) => {
			t.fail(`${this.name}: ${err}`);
		});
});
