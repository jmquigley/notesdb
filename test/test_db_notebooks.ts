'use strict';

import {test} from 'ava';
import * as fs from 'fs-extra';
import * as path from 'path';
import {Artifact} from '../lib/artifact';
import {Fixture} from 'util.fixture';
import {NotesDB} from '../lib/notesdb';
import {validateDB} from './helpers';
// import {validateDB} from './helpers';

test.after.always((t: any) => {
	console.log('final cleanup: test_db_notebooks');
	let directories = Fixture.cleanup();
	directories.forEach((directory: string) => {
		t.false(fs.existsSync(directory));
	});
});

test.cb('Get the list of notebooks from a database', (t: any) => {
	let fixture = new Fixture('simple-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let notesDB = new NotesDB({
		configFile: configFile
	});

	validateDB(notesDB, configFile, 'sampledb', fixture.dir, notesDB.initialized, t);
	let notebooks = notesDB.notebooks('Default');
	let l = [
		'Default',
		'notebook1'
	];

	l.forEach((notebook: string) => {
		t.true(notebooks.indexOf(notebook) > -1);
	});
	t.end();
});

test.cb('Try to get a notebook from an uninitialized database', (t: any) => {
	let fixture = new Fixture('empty-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let notesDB = new NotesDB({
		configFile: configFile
	});

	validateDB(notesDB, configFile, 'sampledb', fixture.dir, notesDB.initialized, t);
	notesDB.initialized = false;

	try {
		let notebooks = notesDB.notebooks('Default');
		t.fail(notebooks.toString());
	} catch (err) {
		t.is(err.message, 'Trying to retrieve notebooks from an unitialized database.');
		t.pass(err);
	}
	t.end();
});

test.cb('Try to get a notebook from a section that does not exist', (t: any) => {
	let fixture = new Fixture('empty-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let notesDB = new NotesDB({
		configFile: configFile
	});

	validateDB(notesDB, configFile, 'sampledb', fixture.dir, notesDB.initialized, t);

	try {
		let notebooks = notesDB.notebooks('////Test1');
		t.fail(notebooks.toString());
	} catch (err) {
		t.is(err.message, `Section '////Test1' not found in binder.`);
		t.pass(err);
	}
	t.end();
});

test('Create a notebook within an existing database', async (t: any) => {
	let fixture = new Fixture('empty-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let adb = new NotesDB({
		configFile: configFile
	});
	let sectionName = 'Test1';
	let l = [
		'notebook1',
		'notebook2'
	];

	validateDB(adb, configFile, 'sampledb', fixture.dir, adb.initialized, t);

	await Promise.all([
		adb.add(Artifact.factory('all', {
			section: sectionName,
			notebook: l[0]
		})),
		adb.add(Artifact.factory('all', {
			section: sectionName,
			notebook: l[1]
		}))
	])
		.then(dbs => {
			t.true(dbs instanceof Array);
			t.is(dbs.length, 2);
			return(dbs[0]);
		})
		.then((adb: NotesDB) => {
			let notebooks: string[] = adb.notebooks(sectionName);
			t.true(notebooks instanceof Array);
			t.is(notebooks.length, 2);

			l.forEach((notebookName: string) => {
				t.true(notebooks.indexOf(notebookName) > -1);
			});

			notebooks.forEach((notebookName: string) => {
				t.true(adb.hasNotebook(notebookName, sectionName));
			});
		})
		.catch((err: string) => {
			t.fail(`${this.name}: ${err}`);
		});
});

test('Try to create a notebook that already exists', async (t: any) => {
	let fixture = new Fixture('empty-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let adb = new NotesDB({
		configFile: configFile
	});
	let sectionName = 'Default';
	let notebookName = 'notebook1';

	validateDB(adb, configFile, 'sampledb', fixture.dir, adb.initialized, t);

	await adb.add(Artifact.factory('all', {
		section: sectionName,
		notebook: notebookName
	}))
		.then((adb: NotesDB) => {
			t.true(adb.hasNotebook(notebookName, sectionName));
		})
		.catch((err: string) => {
			t.fail(`${this.name}: ${err}`);
		});
});

test('Trying to create notebook with a bad name', async (t: any) => {
	let fixture = new Fixture('simple-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let adb = new NotesDB({
		configFile: configFile
	});
	let sectionName = 'Default';
	let notebookName = '////notebook1';

	validateDB(adb, configFile, 'sampledb', fixture.dir, adb.initialized, t);

	await adb.add(Artifact.factory('all', {
		section: sectionName,
		notebook: notebookName
	}))
		.then((adb: NotesDB) => {
			t.fail(adb.toString());
		})
		.catch(err => {
			t.is(err, `Invalid notebook name '${notebookName}'.  Can only use '-\\.+@_!$&0-9a-zA-Z '.`);
			t.pass(err);
		});
});
