'use strict';

import test from 'ava';
import * as fs from 'fs-extra';
import * as path from 'path';
import {Fixture} from 'util.fixture';
import {Artifact, Binder} from '../index';
import {ArtifactType} from '../lib/artifact';
import {cleanup, validateArtifact, validateBinder} from './helpers';

test.after.always(async t => {
	await cleanup(path.basename(__filename), t);
});

test('Load a database with file in the sections directory', t => {
	const fixture = new Fixture('invalid-section');
	const adb = new Binder({
		root: fixture.dir
	});

	validateBinder(t, adb, 'sampledb', fixture.dir, adb.initialized);

	// This will show that the file in the section area is ignored
	t.false(adb.hasSection({section: 'somefile.txt'}));
	t.true(fs.existsSync(path.join(adb.config.dbdir, 'somefile.txt')));
});

test('Load a database with file in the notebooks directory', t => {
	const fixture = new Fixture('invalid-notebook');
	const adb = new Binder({
		root: fixture.dir
	});

	validateBinder(t, adb, 'sampledb', fixture.dir, adb.initialized);

	// This will show that the file in the notebook area is ignored
	t.false(adb.hasNotebook({section: 'Default', notebook: 'somefile.txt'}));
	t.true(fs.existsSync(path.join(adb.config.dbdir, 'Default', 'somefile.txt')));
});

test('Get the list of notebooks from a database', t => {
	const fixture = new Fixture('simple-db');
	const notesDB = new Binder({
		root: fixture.dir
	});

	validateBinder(t, notesDB, 'sampledb', fixture.dir, notesDB.initialized);
	const notebooks = notesDB.notebooks('Default');
	const l = [
		'Default',
		'notebook1'
	];

	l.forEach((notebook: string) => {
		t.true(notebooks.indexOf(notebook) > -1);
	});
});

test('Try to get a notebook from an uninitialized database', t => {
	const fixture = new Fixture('empty-db');
	const notesDB = new Binder({
		root: fixture.dir
	});

	validateBinder(t, notesDB, 'sampledb', fixture.dir, notesDB.initialized);
	notesDB.initialized = false;

	try {
		const notebooks = notesDB.notebooks('Default');
		t.fail(notebooks.toString());
	} catch (err) {
		t.is(err.message, 'Trying to retrieve notebooks from an unitialized database.');
	}
});

test('Try to get a notebook from a section that does not exist', t => {
	const fixture = new Fixture('empty-db');
	const notesDB = new Binder({
		root: fixture.dir
	});

	validateBinder(t, notesDB, 'sampledb', fixture.dir, notesDB.initialized);

	try {
		const notebooks = notesDB.notebooks('////Test1');
		t.fail(notebooks.toString());
	} catch (err) {
		t.is(err.message, `Section '////Test1' not found in binder.`);
	}
});

test('Create a notebook within an existing database', async t => {
	const fixture = new Fixture('empty-db');
	const adb = new Binder({
		root: fixture.dir
	});
	const sectionName = 'Test1';
	const l = [
		'notebook1',
		'notebook2'
	];

	validateBinder(t, adb, 'sampledb', fixture.dir, adb.initialized);

	await Promise.all([
		adb.add(Artifact.factory('fields', {
			section: sectionName,
			notebook: l[0]
		})),
		adb.add(Artifact.factory('fields', {
			section: sectionName,
			notebook: l[1]
		}))])
		.then(artifacts => {
			t.truthy(artifacts instanceof Array);
			t.is(artifacts.length, 2);
			return adb;
		})
		.then((padb: Binder) => {
			const notebooks: string[] = padb.notebooks(sectionName);
			t.truthy(notebooks instanceof Array);
			t.is(notebooks.length, 2);

			l.forEach((notebookName: string) => {
				t.true(notebooks.indexOf(notebookName) > -1);
			});

			notebooks.forEach((notebookName: string) => {
				t.true(padb.hasNotebook({
					notebook: notebookName,
					section: sectionName
				}));
			});
			return padb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(err);
		});
});

test('Try to create a notebook that already exists', async t => {
	const fixture = new Fixture('simple-db');
	const adb = new Binder({
		root: fixture.dir
	});
	const sectionName = 'Default';
	const notebookName = 'notebook1';

	validateBinder(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const testArtifact = Artifact.factory('fields', {
		section: sectionName,
		notebook: notebookName
	});

	await adb.add(testArtifact)
		.then((artifact: Artifact) => {
			validateArtifact(t, artifact, {
				section: sectionName,
				notebook: notebookName,
				type: ArtifactType.SN
			});
			t.true(adb.hasNotebook({notebook: notebookName, section: sectionName}));
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(err);
		});
});

test('Trying to create notebook with a bad name', async t => {
	const fixture = new Fixture('simple-db');
	const adb = new Binder({
		root: fixture.dir
	});
	const sectionName = 'Default';
	const notebookName = '////notebook1';

	validateBinder(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const testArtifact = Artifact.factory('fields', {
		section: sectionName,
		notebook: notebookName
	});

	await adb.add(testArtifact)
		.then((artifact: Artifact) => {
			t.fail(artifact.toString());
		})
		.catch((err: string) => {
			t.is(err, `Invalid notebook name '${notebookName}'.  Can only use '-\\.+@_!$&0-9a-zA-Z '.`);
		});
});

test('Load a database with file in the sections directory', t => {
	const fixture = new Fixture('invalid-notebook');
	const adb = new Binder({
		root: fixture.dir
	});

	validateBinder(t, adb, 'sampledb', fixture.dir, adb.initialized);

	t.false(adb.hasNotebook({section: 'Default', notebook: 'somefile.txt'}));
	t.true(fs.existsSync(path.join(adb.config.dbdir, 'Default', 'somefile.txt')));
});
