'use strict';

import test from 'ava';
import {validateDB} from './helpers';

const path = require('path');
const fs = require('fs-extra');
const Fixture = require('util.fixture');
const NotesDB = require('../notesdb');
const Artifact = require('../artifact');


test.after.always(t => {
	console.log('final cleanup: test_notebook_create');
	let directories = Fixture.cleanup();
	directories.forEach(directory => {
		t.false(fs.existsSync(directory));
	});
});


test('Create a notebook within an existing database', async t => {
	let fixture = new Fixture('simple-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let notesDB = new NotesDB(configFile);
	let sectionName = 'Test1';
	let notebook = [
		'notebook1',
		'notebook2'
	];

	validateDB(notesDB, configFile, 'sampledb', `${fixture.dir}/sampledb`, notesDB.initialized(), fixture, t);

	await Promise.all([
		notesDB.add(new Artifact(sectionName, notebook[0])),
		notesDB.add(new Artifact(sectionName, notebook[1]))
	])
		.then(function() {
			return (notesDB.notebooks(sectionName));
		})
		.then(function(notebooks) {
			t.true(notebooks instanceof Array);
			t.is(notebooks.length, 2);

			notebooks.forEach(name => {
				t.true(notesDB.hasNotebook(name, sectionName));
			});
		})
		.catch(err => {
			t.fail(`${t.context.title}: ${err}`);
		});
});


test('Trying to create notebook with a bad name', async t => {
	let fixture = new Fixture('simple-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let notesDB = new NotesDB(configFile);
	let sectionName = 'Test1';

	validateDB(notesDB, configFile, 'sampledb', `${fixture.dir}/sampledb`, notesDB.initialized(), fixture, t);

	notesDB.add(new Artifact(sectionName, '$$$$$badnotebookname'))
		.catch(err => {
			t.is(err, `Invalid notebook name '$$$$$badnotebookname'`);
			t.pass(err);
		});
});


test('Try to get a notebook from an uninitialized database', async t => {
	let fixture = new Fixture('test-config');
	let configFile = path.join(fixture.dir, 'config.json');
	let notesDB = new NotesDB(configFile);

	validateDB(notesDB, configFile, '', '', !notesDB.initialized(), fixture, t);

	await notesDB.notebooks('Test1')
		.catch(err => {
			t.is(err, 'Trying to retrieve notebooks from an unitialized database.');
			t.pass(err);
		});
});


test('Try to get a notebook from a section that does not exist', async t => {
	let fixture = new Fixture('simple-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let notesDB = new NotesDB(configFile);

	validateDB(notesDB, configFile, 'sampledb', `${fixture.dir}/sampledb`, notesDB.initialized(), fixture, t);

	await notesDB.notebooks('@@@@@@@Test1')
		.catch(err => {
			t.is(err, `Section '@@@@@@@Test1' not found in binder.`);
			t.pass(err);
		});
});
