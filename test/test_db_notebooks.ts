'use strict';

import {test} from 'ava';
import * as fs from 'fs-extra';
import * as path from 'path';
import {Artifact} from '../index';
import {Fixture} from 'util.fixture';
import {NotesDB} from '../index';
import {validateDB, validateArtifact} from './helpers';

test.after.always((t: any) => {
	console.log('final cleanup: test_db_notebooks');
	let directories = Fixture.cleanup();
	directories.forEach((directory: string) => {
		t.false(fs.existsSync(directory));
	});
});

test.cb('Load a database with file in the sections directory', (t: any) => {
	let fixture = new Fixture('invalid-section');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	// This will show that the file in the section area is ignored
	t.false(adb.hasSection({section: 'somefile.txt'}));
	t.true(fs.existsSync(path.join(adb.config.dbdir, 'somefile.txt')));
	t.end();
});

test.cb('Load a database with file in the notebooks directory', (t: any) => {
	let fixture = new Fixture('invalid-notebook');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	// This will show that the file in the notebook area is ignored
	t.false(adb.hasNotebook({section: 'Default', notebook: 'somefile.txt'}));
	t.true(fs.existsSync(path.join(adb.config.dbdir, 'Default', 'somefile.txt')));
	t.end();
});

test.cb('Get the list of notebooks from a database', (t: any) => {
	let fixture = new Fixture('simple-db');
	let notesDB = new NotesDB({
		root: fixture.dir
	});

	validateDB(notesDB, 'sampledb', fixture.dir, notesDB.initialized, t);
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
	let notesDB = new NotesDB({
		root: fixture.dir
	});

	validateDB(notesDB, 'sampledb', fixture.dir, notesDB.initialized, t);
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
	let notesDB = new NotesDB({
		root: fixture.dir
	});

	validateDB(notesDB, 'sampledb', fixture.dir, notesDB.initialized, t);

	try {
		let notebooks = notesDB.notebooks('////Test1');
		t.fail(notebooks.toString());
	} catch (err) {
		t.is(err.message, `Section '////Test1' not found in binder.`);
		t.pass(err);
	}
	t.end();
});

test('Create a notebook within an existing database', async(t: any) => {
	let fixture = new Fixture('empty-db');
	let adb = new NotesDB({
		root: fixture.dir
	});
	let sectionName = 'Test1';
	let l = [
		'notebook1',
		'notebook2'
	];

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	await Promise.all([
		adb.add(Artifact.factory('fields', {
			section: sectionName,
			notebook: l[0]
		})),
		adb.add(Artifact.factory('fields', {
			section: sectionName,
			notebook: l[1]
		}))])
		.then((artifacts) => {
			t.true(artifacts instanceof Array);
			t.is(artifacts.length, 2);
			return adb;
		})
		.then((adb: NotesDB) => {
			let notebooks: string[] = adb.notebooks(sectionName);
			t.true(notebooks instanceof Array);
			t.is(notebooks.length, 2);

			l.forEach((notebookName: string) => {
				t.true(notebooks.indexOf(notebookName) > -1);
			});

			notebooks.forEach((notebookName: string) => {
				t.true(adb.hasNotebook({
					notebook: notebookName,
					section: sectionName
				}));
			});
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(`${this.name}: ${err}`);
		});
});

test('Try to create a notebook that already exists', async (t: any) => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir
	});
	let sectionName = 'Default';
	let notebookName = 'notebook1';

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	let artifact = Artifact.factory('fields', {
		section: sectionName,
		notebook: notebookName
	});

	await adb.add(artifact)
		.then((artifact: Artifact) => {
			validateArtifact(artifact, sectionName, notebookName, '', t);
			t.true(adb.hasNotebook({notebook: notebookName, section: sectionName}));
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(`${this.name}: ${err}`);
		});
});

test('Trying to create notebook with a bad name', async (t: any) => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir
	});
	let sectionName = 'Default';
	let notebookName = '////notebook1';

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	let artifact = Artifact.factory('fields', {
		section: sectionName,
		notebook: notebookName
	});

	await adb.add(artifact)
		.then((artifact: Artifact) => {
			t.fail(artifact.toString());
		})
		.catch(err => {
			t.is(err, `Invalid notebook name '${notebookName}'.  Can only use '-\\.+@_!$&0-9a-zA-Z '.`);
			t.pass(err);
		});
});

test('Load a database with file in the sections directory', async (t: any) => {
	let fixture = new Fixture('invalid-notebook');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	// TODO: this test is incomplete
});
