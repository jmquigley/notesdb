'use strict';

import test from 'ava';

const path = require('path');
const fs = require('fs-extra');
const Fixture = require('util.fixture');
const uuidV4 = require('uuid/v4');
const NotesDB = require('../index');


function validateDB(notesDB, configFile, binderName, root, valid, fixture, t) {  // eslint-disable-line max-params
	t.true(notesDB && typeof notesDB !== 'undefined' && notesDB instanceof NotesDB);
	t.is(notesDB.config.configFile, configFile);
	t.is(notesDB.config.binderName, binderName);
	t.is(notesDB.config.root, root);
	t.true(valid);

	if (fixture) {
		t.true(fs.existsSync(path.join(fixture.dir, 'notesdb.log')));
	}
}


test('Create a new db instance with a default configuration', t => {
	let fixture = new Fixture('tmpdir');
	let configFile = path.join(fixture.dir, uuidV4(), 'config.json');

	let notesDB = new NotesDB('', {
		defaultConfigFile: configFile
	});

	validateDB(notesDB, configFile, '', '', !notesDB.initialized(), null, t);

	fixture.cleanup();
});


test('Create new database with NOTESDB_HOME environment variable', t => {
	let fixture = new Fixture('tmpdir');

	process.env.NOTESDB_HOME = path.join(fixture.dir, uuidV4(), 'config.json');
	let notesDB = new NotesDB();

	validateDB(notesDB, process.env.NOTESDB_HOME, '', '', !notesDB.initialized(), null, t);

	process.env.NOTESDB_HOME = '';
	fixture.cleanup();
});


test('Create new database with custom configuration file', t => {
	let fixture = new Fixture('tmpdir');

	let configFile = path.join(fixture.dir, uuidV4(), 'config.json');
	let notesDB = new NotesDB(configFile);

	validateDB(notesDB, configFile, '', '', !notesDB.initialized(), null, t);

	fixture.cleanup();
});


test('Create an initial binder', t => {
	let fixture = new Fixture('test-config');
	let configFile = path.join(fixture.dir, 'config.json');
	let binder = `testdb`;
	let notesDB = new NotesDB(configFile);

	validateDB(notesDB, configFile, '', '', !notesDB.initialized(), fixture, t);

	notesDB.createBinder(binder, fixture.dir, {
		schema: [
			'Test1',
			'Test2'
		]
	});

	t.is(notesDB.config.binderName, binder);
	t.is(notesDB.config.root, path.join(fixture.dir, binder));

	let schema = [
		'Default',
		'Test1',
		'Test2'
	];
	notesDB.getSections().forEach(section => {
		t.true(schema.indexOf(section) > -1);
	});

	fixture.cleanup();
});


test('Try to create a binder with a bad name (negative test)', t => {
	let fixture = new Fixture('test-config');
	let configFile = path.join(fixture.dir, 'config.json');
	let binder = `@@@@testdb`;
	let notesDB = new NotesDB(configFile);

	validateDB(notesDB, configFile, '', '', !notesDB.initialized(), fixture, t);

	try {
		notesDB.createBinder(binder, fixture.dir);
	} catch (err) {
		t.pass(err.message);
	}

	fixture.cleanup();
});


test('Try to create a binder with bad section name (negative test)', t => {
	let fixture = new Fixture('simple-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let notesDB = new NotesDB(configFile);

	validateDB(notesDB, configFile, 'sampledb', `${fixture.dir}/sampledb`, notesDB.initialized(), fixture, t);

	try {
		notesDB.createSection('@@@badSectionName');
	} catch (err) {
		t.pass(err.message);
	}

	fixture.cleanup();
});


test('Open existing database with NOTESDB_HOME environment variable configuration', t => {
	let fixture = new Fixture('simple-db');
	let configFile = path.join(fixture.dir, 'config.json');
	process.env.NOTESDB_HOME = configFile;
	let notesDB = new NotesDB();

	validateDB(notesDB, configFile, 'sampledb', `${fixture.dir}/sampledb`, notesDB.initialized(), fixture, t);

	let schema = [
		'Default',
		'Test1',
		'Test2'
	];
	notesDB.getSections().forEach(section => {
		t.true(schema.indexOf(section) > -1);
	});

	process.env.NOTESDB_HOME = '';
	fixture.cleanup();
});


test('Open existing database with defaultConfigFile location', t => {
	let fixture = new Fixture('simple-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let notesDB = new NotesDB('', {defaultConfigFile: configFile});

	validateDB(notesDB, configFile, 'sampledb', `${fixture.dir}/sampledb`, notesDB.initialized(), fixture, t);

	let schema = [
		'Default',
		'Test1',
		'Test2'
	];

	notesDB.getSections().forEach(section => {
		t.true(schema.indexOf(section) > -1);
	});

	fixture.cleanup();
});


test('Try to load existing database with missing config file', t => {
	let fixture = new Fixture('missing-db-config');
	let configFile = path.join(fixture.dir, 'config.json');

	try {
		let notesDB = new NotesDB('', {defaultConfigFile: configFile});
		notesDB.toString();
	} catch (err) {
		t.pass(err.message);
	}

	fixture.cleanup();
});


test('Try to load existing database with missing root directory', t => {
	let fixture = new Fixture('missing-db-root');
	let configFile = path.join(fixture.dir, 'config.json');

	try {
		let notesDB = new NotesDB('', {defaultConfigFile: configFile});
		notesDB.toString();
	} catch (err) {
		t.pass(err.message);
	}

	fixture.cleanup();
});


test('Try to get sections from an unitialized database', t => {
	let fixture = new Fixture('test-config');
	let configFile = path.join(fixture.dir, 'config.json');
	let notesDB = new NotesDB(configFile);

	validateDB(notesDB, configFile, '', '', !notesDB.initialized(), fixture, t);

	let sections = notesDB.getSections();

	t.true(sections instanceof Array);
	t.is(sections.length, 0);

	fixture.cleanup();
});


test('Get the sections from an existing database', t => {
	let fixture = new Fixture('simple-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let notesDB = new NotesDB(configFile);

	validateDB(notesDB, configFile, 'sampledb', `${fixture.dir}/sampledb`, notesDB.initialized(), fixture, t);

	let sections = notesDB.getSections();

	t.true(sections instanceof Array);
	t.is(sections.length, 3);

	let schema = [
		'Default',
		'Test1',
		'Test2'
	];

	schema.forEach(name => {
		t.true(notesDB.hasSection(name));
	});

	fixture.cleanup();
});

test('Create a new section within an existing database', t => {
	let fixture = new Fixture('simple-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let notesDB = new NotesDB(configFile);

	validateDB(notesDB, configFile, 'sampledb', `${fixture.dir}/sampledb`, notesDB.initialized(), fixture, t);

	notesDB.createSection('Test3');

	let sections = notesDB.getSections();

	t.true(sections instanceof Array);
	t.is(sections.length, 4);

	let schema = [
		'Default',
		'Test1',
		'Test2',
		'Test3'
	];

	schema.forEach(name => {
		t.true(notesDB.hasSection(name));
	});

	t.true(fs.existsSync(path.join(notesDB.config.root, 'Test3')));

	fixture.cleanup();
});


test('Try to create a section that already exists within a database', t => {
	let fixture = new Fixture('simple-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let notesDB = new NotesDB(configFile);

	validateDB(notesDB, configFile, 'sampledb', `${fixture.dir}/sampledb`, notesDB.initialized(), fixture, t);

	notesDB.createSection('Test1');

	let sections = notesDB.getSections();

	t.true(sections instanceof Array);
	t.is(sections.length, 3);

	let schema = [
		'Default',
		'Test1',
		'Test2'
	];

	schema.forEach(name => {
		t.true(notesDB.hasSection(name));
	});

	fixture.cleanup();
});


test('The database toString() function', t => {
	let fixture = new Fixture('simple-empty-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let notesDB = new NotesDB(configFile);

	validateDB(notesDB, configFile, 'sampledb', `${fixture.dir}/sampledb`, notesDB.initialized(), fixture, t);

	t.true(typeof notesDB.toString() === 'string');

	fixture.cleanup();
});
