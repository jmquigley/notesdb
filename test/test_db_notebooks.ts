'use strict';

import * as assert from 'assert';
import * as fs from 'fs-extra';
import * as path from 'path';
import {Fixture} from 'util.fixture';
import {Artifact, NotesDB} from '../index';
import {ArtifactType} from '../lib/artifact';
import {validateArtifact, validateDB} from './helpers';

describe(path.basename(__filename), () => {

	// after(() => {
	// 	debug('final cleanup: test_db_notebooks');
	// 	let directories = Fixture.cleanup();
	// 	directories.forEach((directory: string) => {
	// 		assert(!fs.existsSync(directory));
	// 	});
	//
	// });

	it('Load a database with file in the sections directory', () => {
		let fixture = new Fixture('invalid-section');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		// This will show that the file in the section area is ignored
		assert(!adb.hasSection({section: 'somefile.txt'}));
		assert(fs.existsSync(path.join(adb.config.dbdir, 'somefile.txt')));
	});

	it('Load a database with file in the notebooks directory', () => {
		let fixture = new Fixture('invalid-notebook');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		// This will show that the file in the notebook area is ignored
		assert(!adb.hasNotebook({section: 'Default', notebook: 'somefile.txt'}));
		assert(fs.existsSync(path.join(adb.config.dbdir, 'Default', 'somefile.txt')));
	});

	it('Get the list of notebooks from a database', () => {
		let fixture = new Fixture('simple-db');
		let notesDB = new NotesDB({
			root: fixture.dir
		});

		validateDB(notesDB, 'sampledb', fixture.dir, notesDB.initialized);
		let notebooks = notesDB.notebooks('Default');
		let l = [
			'Default',
			'notebook1'
		];

		l.forEach((notebook: string) => {
			assert(notebooks.indexOf(notebook) > -1);
		});
	});

	it('Try to get a notebook from an uninitialized database', () => {
		let fixture = new Fixture('empty-db');
		let notesDB = new NotesDB({
			root: fixture.dir
		});

		validateDB(notesDB, 'sampledb', fixture.dir, notesDB.initialized);
		notesDB.initialized = false;

		try {
			let notebooks = notesDB.notebooks('Default');
			assert(false, notebooks.toString());
		} catch (err) {
			assert.equal(err.message, 'Trying to retrieve notebooks from an unitialized database.');
		}
	});

	it('Try to get a notebook from a section that does not exist', () => {
		let fixture = new Fixture('empty-db');
		let notesDB = new NotesDB({
			root: fixture.dir
		});

		validateDB(notesDB, 'sampledb', fixture.dir, notesDB.initialized);

		try {
			let notebooks = notesDB.notebooks('////Test1');
			assert(false, notebooks.toString());
		} catch (err) {
			assert.equal(err.message, `Section '////Test1' not found in binder.`);
		}
	});

	it('Create a notebook within an existing database', async() => {
		let fixture = new Fixture('empty-db');
		let adb = new NotesDB({
			root: fixture.dir
		});
		let sectionName = 'Test1';
		let l = [
			'notebook1',
			'notebook2'
		];

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

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
				assert(artifacts instanceof Array);
				assert.equal(artifacts.length, 2);
				return adb;
			})
			.then((padb: NotesDB) => {
				let notebooks: string[] = padb.notebooks(sectionName);
				assert(notebooks instanceof Array);
				assert.equal(notebooks.length, 2);

				l.forEach((notebookName: string) => {
					assert(notebooks.indexOf(notebookName) > -1);
				});

				notebooks.forEach((notebookName: string) => {
					assert(padb.hasNotebook({
						notebook: notebookName,
						section: sectionName
					}));
				});
				return padb;
			})
			.then(adb.shutdown)
			.catch((err: string) => {
				assert(false, err);
			});
	});

	it('Try to create a notebook that already exists', async () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir
		});
		let sectionName = 'Default';
		let notebookName = 'notebook1';

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		let testArtifact = Artifact.factory('fields', {
			section: sectionName,
			notebook: notebookName
		});

		await adb.add(testArtifact)
			.then((artifact: Artifact) => {
				validateArtifact(artifact, {
					section: sectionName,
					notebook: notebookName,
					type: ArtifactType.SN
				});
				assert(adb.hasNotebook({notebook: notebookName, section: sectionName}));
				return adb;
			})
			.then(adb.shutdown)
			.catch((err: string) => {
				assert(err);
			});
	});

	it('Trying to create notebook with a bad name', async () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir
		});
		let sectionName = 'Default';
		let notebookName = '////notebook1';

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		let testArtifact = Artifact.factory('fields', {
			section: sectionName,
			notebook: notebookName
		});

		await adb.add(testArtifact)
			.then((artifact: Artifact) => {
				assert(false, artifact.toString());
			})
			.catch((err: string) => {
				assert.equal(err, `Invalid notebook name '${notebookName}'.  Can only use '-\\.+@_!$&0-9a-zA-Z '.`);
			});
	});

	it('Load a database with file in the sections directory', () => {
		let fixture = new Fixture('invalid-notebook');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		assert(!adb.hasNotebook({section: 'Default', notebook: 'somefile.txt'}));
		assert(fs.existsSync(path.join(adb.config.dbdir, 'Default', 'somefile.txt')));
	});
});
