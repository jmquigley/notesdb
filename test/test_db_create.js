'use strict';

import test from 'ava';
import {validateDB} from './helpers';

const path = require('path');
const _ = require('lodash');
const fs = require('fs-extra');
const Fixture = require('util.fixture');
const uuidV4 = require('uuid/v4');
const pkg = require('../package.json');
const NotesDB = require('../notesdb');
const Artifact = require('../artifact');


test.after.always(t => {
	console.log('final cleanup: test_db_create');
	let directories = Fixture.cleanup();
	directories.forEach(directory => {
		t.false(fs.existsSync(directory));
	});
});


test('The database toString() function', t => {
	let fixture = new Fixture('initial-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let notesDB = new NotesDB(configFile);

	validateDB(notesDB, configFile, 'sampledb', `${fixture.dir}/sampledb`, notesDB.initialized(), fixture, t);

	let s = notesDB.toString();
	t.true(typeof s === 'string');

	if (pkg.debug) {
		console.log(s);
	}
});


test('Create a new database with a default configuration', t => {
	let fixture = new Fixture('tmpdir');
	let configFile = path.join(fixture.dir, uuidV4(), 'config.json');
	let notesDB = new NotesDB('', {
		defaultConfigFile: configFile
	});

	validateDB(notesDB, configFile, '', '', !notesDB.initialized(), null, t);
});


test('Create new database with NOTESDB_HOME environment variable', t => {
	let fixture = new Fixture('tmpdir');
	let env = _.cloneDeep(process.env);

	env.NOTESDB_HOME = path.join(fixture.dir, uuidV4(), 'config.json');
	let notesDB = new NotesDB('', {
		env: env
	});

	validateDB(notesDB, env.NOTESDB_HOME, '', '', !notesDB.initialized(), null, t);
});


test('Create new database with custom configuration file', t => {
	let fixture = new Fixture('tmpdir');

	let configFile = path.join(fixture.dir, uuidV4(), 'config.json');
	let notesDB = new NotesDB(configFile);

	validateDB(notesDB, configFile, '', '', !notesDB.initialized(), null, t);
});


test('Create an initial binder', async t => {
	let fixture = new Fixture('test-config');
	let configFile = path.join(fixture.dir, 'config.json');
	let binder = `testdb`;
	let notesDB = new NotesDB(configFile);

	validateDB(notesDB, configFile, '', '', !notesDB.initialized(), fixture, t);

	await notesDB.create(binder, fixture.dir, {
		schema: [
			'Test1',
			'Test2'
		]})
		.then(db => {
			t.is(notesDB.config.binderName, binder);
			t.is(notesDB.config.root, path.join(fixture.dir, binder));
			return (db.sections());
		})
		.then(sections => {
			let l = [
				'Default',
				'Test1',
				'Test2'
			];

			sections.forEach(section => {
				t.true(l.indexOf(section) > -1);
			});
		})
		.catch(function(err) {
			t.fail(`${t.context.title}: ${err}`);
		});
});


test('Try to create a binder with a bad name (negative test)', async t => {
	let fixture = new Fixture('test-config');
	let configFile = path.join(fixture.dir, 'config.json');
	let binder = `@@@@testdb`;
	let notesDB = new NotesDB(configFile);

	validateDB(notesDB, configFile, '', '', !notesDB.initialized(), fixture, t);

	await notesDB.create(binder, fixture.dir)
		.catch(err => {
			t.pass(err);
		});
});

test('Create a binder with a bad initial section name', async t => {
	let fixture = new Fixture('test-config');
	let configFile = path.join(fixture.dir, 'config.json');
	let binder = `testdb`;
	let notesDB = new NotesDB(configFile);

	validateDB(notesDB, configFile, '', '', !notesDB.initialized(), fixture, t);

	await notesDB.create(binder, fixture.dir, {
		schema: [
			'@@@@@@@Test1'
		]})
		.catch(function(err) {
			t.is(err, `Invalid section name '@@@@@@@Test1'.  Can only use 'a-Z, 0-9, _'`);
			t.pass(err);
		});
});


test('Open existing database with NOTESDB_HOME environment variable configuration', async t => {
	let fixture = new Fixture('simple-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let env = _.cloneDeep(process.env);

	env.NOTESDB_HOME = configFile;

	let notesDB = new NotesDB('', {
		env: env
	});

	validateDB(notesDB, configFile, 'sampledb', `${fixture.dir}/sampledb`, notesDB.initialized(), fixture, t);

	let l = [
		'Default',
		'Test1',
		'Test2'
	];

	await notesDB.sections()
		.then(sections => {
			sections.forEach(section => {
				t.true(l.indexOf(section) > -1);
			});
		})
		.catch(err => {
			t.fail(`${t.context.title}: ${err}`);
		});
});


test('Open existing database with defaultConfigFile location', async t => {
	process.env.NOTESDB_HOME = '';
	let fixture = new Fixture('simple-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let notesDB = new NotesDB('', {
		defaultConfigFile: configFile,
		saveInterval: 10
	});

	validateDB(notesDB, configFile, 'sampledb', `${fixture.dir}/sampledb`, notesDB.initialized(), fixture, t);

	let l = [
		'Default',
		'Test1',
		'Test2'
	];

	await notesDB.sections()
		.then(sections => {
			sections.forEach(section => {
				t.true(l.indexOf(section) > -1);
			});
		})
		.catch(err => {
			t.fail(`${t.context.title}: ${err}`);
		});
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
});


test('Try to get sections from an unitialized database', async t => {
	let fixture = new Fixture('test-config');
	let configFile = path.join(fixture.dir, 'config.json');
	let notesDB = new NotesDB(configFile);

	validateDB(notesDB, configFile, '', '', !notesDB.initialized(), fixture, t);

	await notesDB.sections()
		.then(null)
		.catch(err => {
			t.pass(`${t.context.title}: ${err}`);
		});
});


test('Get the sections from an existing database', async t => {
	let fixture = new Fixture('simple-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let notesDB = new NotesDB(configFile);

	validateDB(notesDB, configFile, 'sampledb', `${fixture.dir}/sampledb`, notesDB.initialized(), fixture, t);

	await notesDB.sections()
		.then(sections => {
			t.true(sections instanceof Array);
			t.is(sections.length, 3);

			let l = [
				'Default',
				'Test1',
				'Test2'
			];

			l.forEach(name => {
				t.true(notesDB.hasSection(name));
			});
		})
		.catch(err => {
			t.fail(`${t.context.title}: ${err}`);
		});
});


test('Create a new section within an existing database', async t => {
	let fixture = new Fixture('simple-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let notesDB = new NotesDB(configFile);

	validateDB(notesDB, configFile, 'sampledb', `${fixture.dir}/sampledb`, notesDB.initialized(), fixture, t);

	let artifact = new Artifact('Test3');
	t.true(artifact instanceof Artifact);

	await notesDB.add(artifact)
		.then(db => {
			return db.sections();
		})
		.then(sections => {
			t.true(sections instanceof Array);
			t.is(sections.length, 4);

			let l = [
				'Default',
				'Test1',
				'Test2',
				'Test3'
			];

			l.forEach(name => {
				t.true(notesDB.hasSection(name));
			});

			t.true(fs.existsSync(path.join(notesDB.config.root, 'Test3')));
		})
		.catch(err => {
			t.fail(`${t.context.title}: ${err}`);
		});
});


test('Try to create a binder with bad section name (negative test)', async t => {
	let fixture = new Fixture('simple-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let notesDB = new NotesDB(configFile);

	validateDB(notesDB, configFile, 'sampledb', `${fixture.dir}/sampledb`, notesDB.initialized(), fixture, t);

	let artifact = new Artifact('@@@badSectionName');
	t.true(artifact instanceof Artifact);

	await notesDB.add(artifact)
		.catch(err => {
			t.pass(err);
		});
});


test('Try to create a section that already exists within a database', async t => {
	let fixture = new Fixture('simple-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let notesDB = new NotesDB(configFile);

	validateDB(notesDB, configFile, 'sampledb', `${fixture.dir}/sampledb`, notesDB.initialized(), fixture, t);

	let artifact = new Artifact('Test1');
	t.true(artifact instanceof Artifact);

	await notesDB.add(artifact)
		.catch(err => {
			t.pass(err);
		});
});


test('Test artifact add with bad artifact', async t => {
	let fixture = new Fixture('simple-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let notesDB = new NotesDB(configFile);

	validateDB(notesDB, configFile, 'sampledb', `${fixture.dir}/sampledb`, notesDB.initialized(), fixture, t);

	await notesDB.add(null)
		.catch(err => {
			t.is(err, 'Invalid artifact given for creation');
			t.pass(err);
		});
});
