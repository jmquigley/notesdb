'use strict';

import * as assert from 'assert';
import * as fs from 'fs-extra';
import * as path from 'path';
import {Fixture} from 'util.fixture';
import {waitPromise} from 'util.wait';
import * as uuid from 'uuid';
import {Artifact} from '../index';
import {IArtifactSearch} from '../lib/artifact';
import {NotesDB} from '../index';
import {debug, validateDB} from './helpers';

const pkg = require('../package.json');

describe('DB Create', () => {

	after(() => {
		debug('final cleanup: test_db_create');
		let directories = Fixture.cleanup();
		directories.forEach((directory: string) => {
			assert(!fs.existsSync(directory));
		});
	});

	it('The database toString() function', () => {
		let fixture = new Fixture('empty-db');
		let adb = new NotesDB({
			binderName: 'sampledb',
			configRoot: fixture.dir,
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		let s = adb.toString();
		assert(typeof s === 'string');

		if (pkg.debug) {
			console.log(s);
		}
	});

	it('Create a new database with a custom configuration', () => {
		let fixture = new Fixture();
		let dir = path.join(fixture.dir, uuid.v4());
		let adb = new NotesDB({
			root: dir
		});

		validateDB(adb, 'adb', dir, adb.initialized);
	});

	it('Create an initial binder', async () => {
		let fixture = new Fixture('empty-db');
		let notesDB = new NotesDB({
			root: fixture.dir
		});

		validateDB(notesDB, 'sampledb', fixture.dir, notesDB.initialized);

		await notesDB.create(['Test1', 'Test2'])
			.then((adb: NotesDB) => {
				let sections = adb.sections();
				let l = [
					'Default',
					'Test1',
					'Test2',
					'Trash'
				];

				assert.equal(sections.length, 4);
				sections.forEach((section: string) => {
					assert(l.indexOf(section) > -1);
				});

				return adb;
			})
			.then(notesDB.shutdown)
			.catch((err: string) => {
				assert(false, err);
			});
	});

	it('Create an initial binder with empty schema', async () => {
		let fixture = new Fixture('empty-db');
		let notesDB = new NotesDB({
			root: fixture.dir
		});

		validateDB(notesDB, 'sampledb', fixture.dir, notesDB.initialized);
		await notesDB.create([])
			.then((adb: NotesDB) => {
				assert(adb.hasSection({section: 'Default'}));
				return adb;
			})
			.then(notesDB.shutdown)
			.catch((err: string) => {
				assert(false, err);
			});
	});

	it('Try to create a binder with a bad name (negative test)', () => {
		let fixture = new Fixture('tmpdir');
		let binderName:string = '////testdb';

		try {
			let adb = new NotesDB({
				binderName: binderName,
				root: fixture.dir
			});
			assert(false, adb.toString());
		} catch (err) {
			assert.equal(err.message, `Invalid binder name '${binderName}'.  Can only use '-\\.+@_!$&0-9a-zA-Z '.`);
		}
	});

	it('Create a binder with a bad initial section name', async () => {
		let fixture = new Fixture('empty-db');
		let notesDB = new NotesDB({
			root: fixture.dir
		});
		let binderName: string = '////Test1';

		validateDB(notesDB, 'sampledb', fixture.dir, notesDB.initialized);

		await notesDB.create(binderName)
			.then((adb: NotesDB) => {
				assert(false, adb.toString());
			})
			.catch((err: string) => {
				assert.equal(err, `Invalid section name '${binderName}'.  Can only use '-\\.+@_!$&0-9a-zA-Z '.`);
			});
	});

	it('Open existing database with defaultConfigFile location', async () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		// Check for sections
		assert(adb.hasSection({section: 'Default'}));
		assert(adb.hasSection({section: 'Test1'}));
		assert(adb.hasSection({section: 'Test2'}));

		// Check for notebooks
		assert(adb.hasNotebook({notebook: 'Default', section: 'Default'}));
		assert(adb.hasNotebook({notebook: 'notebook1', section: 'Default'}));
		assert(adb.hasNotebook({notebook: 'Default', section: 'Test1'}));
		assert(adb.hasNotebook({notebook: 'Default', section: 'Test2'}));

		// Check for artifacts within notebooks
		let artifact = Artifact.factory('fields', {
			section: 'Default',
			notebook: 'Default',
			filename: 'test1.txt'
		});
		assert(adb.hasArtifact(artifact));

		artifact = Artifact.factory('fields', {
			section: 'Default',
			notebook: 'notebook1',
			filename: 'test2.txt'
		});
		assert(adb.hasArtifact(artifact));

		artifact = Artifact.factory('fields', {
			section: 'Test1',
			notebook: 'Default',
			filename: 'test3.txt'
		});
		assert(adb.hasArtifact(artifact));

		artifact = Artifact.factory('fields', {
			section: 'Test2',
			notebook: 'Default',
			filename: 'test4.txt'
		});
		assert(adb.hasArtifact(artifact));

	await adb.shutdown()
		.then((msg: string) => {
			assert.equal(msg, 'The database is shutdown.')
		})
		.catch((err: string) => {
			assert(false, err);
		});
	});

	it('Try to load existing database with missing config file (negative test)', () => {
		let fixture = new Fixture('missing-db-config');

		try {
			let adb = new NotesDB({
				root: fixture.dir
			});
			assert(false, adb.toString());
		} catch (err) {
			assert.equal(err.message, `Can't find notesdb configuration: badconfigfile.`);
		}
	});

	it('Try to load existing database with missing root directory (negative test)', () => {
		let fixture = new Fixture('missing-db-root');

		try {
			let adb = new NotesDB({
				root: fixture.dir
			});
			assert(false, adb.toString());
		} catch (err) {
			assert.equal(err.message, `No notesdb located @ badrootdirsampledb.`);
		}
	});

	it('Try to create a database with a missing dbdir in the config (negative test)', () => {
		let fixture = new Fixture('missing-db-dbdir');

		try {
			let adb = new NotesDB({
				root: fixture.dir
			});
			assert(false, adb.toString());
		} catch (err) {
			assert.equal(err.message, `The database directory is missing from configuration.`);
		}
	});

	it('Test trying to save a bad configuration file (negative test)', async () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);
		adb.config.configFile = '';  // destroy config reference

		await adb.save()
			.then(adb => {
				assert(false, adb.toString());
			})
			.catch(err => {
				assert.equal(err, `ENOENT: no such file or directory, open ''`);
			});
	});

	it('Test trying to save a bad metadata file (negative test)', async () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);
		adb.config.metaFile = '';  // destroy config reference

		await adb.save()
			.then(adb => {
				assert(false, adb.toString());
			})
			.catch(err => {
				assert.equal(err, `ENOENT: no such file or directory, open ''`);
			});
	});

	it('Test the timed save facility', async () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir,
			saveInterval: 1000
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		await waitPromise(5)
			.then(() => {
				assert(adb.timedSave);
				return adb;
			})
			.then(adb.shutdown)
			.catch((err: string) => {
				assert(false, err);
			});
	});

	it('Test the reload function', async () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir,
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		let filename = 'outside.txt';
		let data = 'Test outside data file';
		let lookup: IArtifactSearch = {
			section: 'Default',
			notebook: 'Default',
			filename: filename
		};

		assert(adb.initialized);
		assert(!adb.hasArtifact(lookup));

		fs.writeFileSync(path.join(adb.config.dbdir, 'Default', 'Default', filename), data);

		await adb.reload()
			.then((adb: NotesDB) => {
				assert(adb.hasArtifact(lookup));
				return adb.get(lookup)
			})
			.then((artifact: Artifact) => {
				assert.equal(artifact.buf, data);
				return adb;
			})
			.then(adb.shutdown)
			.catch((err: string) => {
				assert(false, err);
			});
	});

	it('Try to add an empty item to an existing database', async () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		await adb.add({})
			.then((artifact: Artifact) => {
				assert(false, artifact.toString())
			})
			.catch((err: string) => {
				assert.equal(err, 'Trying to add invalid artifact to DB');
			});
	});

	it('Test has functions for NotesDB', () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		// Successful tests
		assert(adb.hasSection({section: 'Test1'}));
		assert(adb.hasNotebook({section: 'Test1', notebook: 'Default'}));
		assert(adb.hasArtifact({section: 'Test1', notebook: 'Default', filename: 'test3.txt'}));

		// Failure tests
		assert(!adb.hasSection({section: 'blah'}));
		assert(!adb.hasSection({section: 'blah'}, 'badarea'));
		assert(!adb.hasNotebook({section: 'Test1', notebook: 'blah'}));
		assert(!adb.hasNotebook({section: 'blah', notebook: 'blah'}));
		assert(!adb.hasArtifact({section: 'Test1', notebook: 'Default', filename: 'blah.txt'}));
		assert(!adb.hasArtifact({section: 'Test1', notebook: 'blah', filename: 'blah.txt'}));
		assert(!adb.hasArtifact({section: 'blah', notebook: 'blah', filename: 'blah.txt'}));
	});

	it('Test simple database with additional ignored directories', () => {
		let fixture = new Fixture('simple-db-with-ignored');
		let adb = new NotesDB({
			root: fixture.dir,
			ignore: ['Attachments', 'Images']
		});
		let l: string[] = ['Test1', 'Test2'];

		let sections: string[] = adb.sections();
		assert.equal(sections.length, 2);
		for (let section of sections) {
			assert(l.indexOf(section) !== -1);
		}

		assert(fs.existsSync(path.join(adb.config.dbdir, 'Attachments')));
		assert(fs.existsSync(path.join(adb.config.dbdir, 'Images')));
		assert(fs.existsSync(path.join(adb.config.dbdir, 'Test1')));
		assert(fs.existsSync(path.join(adb.config.dbdir, 'Test2')));
	});
});
