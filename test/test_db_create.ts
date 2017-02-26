'use strict';

import {test} from 'ava';
import * as fs from 'fs-extra';
import * as path from 'path';
import {Fixture} from 'util.fixture';
import {wait} from 'util.wait';
import * as uuid from 'uuid';
import {Artifact} from '../index';
import {IArtifactSearch} from '../lib/artifact';
import {NotesDB} from '../index';
import {validateDB} from './helpers';

const pkg = require('../package.json');

test.after.always((t: any) => {
	console.log('final cleanup: test_db_create');
	let directories = Fixture.cleanup();
	directories.forEach((directory: string) => {
		t.false(fs.existsSync(directory));
	});
});

test.cb('The database toString() function', (t: any) => {
	let fixture = new Fixture('empty-db');
	let adb = new NotesDB({
		binderName: 'sampledb',
		configRoot: fixture.dir,
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	let s = adb.toString();
	t.true(typeof s === 'string');

	if (pkg.debug) {
		console.log(s);
	}
	t.end();
});

test.cb('Create a new database with a custom configuration', (t: any) => {
	let fixture = new Fixture();
	let dir = path.join(fixture.dir, uuid.v4());
	let adb = new NotesDB({
		root: dir
	});

	validateDB(adb, 'adb', dir, adb.initialized, t);

	t.end();
});

test('Create an initial binder', async (t: any) => {
	let fixture = new Fixture('empty-db');
	let notesDB = new NotesDB({
		root: fixture.dir
	});

	validateDB(notesDB, 'sampledb', fixture.dir, notesDB.initialized, t);

	await notesDB.create(['Test1', 'Test2'])
		.then((adb: NotesDB) => {
			let sections = adb.sections();
			let l = [
				'Default',
				'Test1',
				'Test2',
				'Trash'
			];

			t.is(sections.length, 4);
			sections.forEach((section: string) => {
				t.true(l.indexOf(section) > -1);
			});

			return adb;
		})
		.then(notesDB.shutdown)
		.catch((err: string) => {
			t.fail(`${t.title}: ${err}`);
		});
});

test('Create an initial binder with empty schema', async (t: any) => {
	let fixture = new Fixture('empty-db');
	let notesDB = new NotesDB({
		root: fixture.dir
	});

	validateDB(notesDB, 'sampledb', fixture.dir, notesDB.initialized, t);
	await notesDB.create([])
		.then((adb: NotesDB) => {
			t.true(adb.hasSection({section: 'Default'}));
			return adb;
		})
		.then(notesDB.shutdown)
		.catch((err: string) => {
			t.fail(`${t.title}: ${err}`);
		});
});

test.cb('Try to create a binder with a bad name (negative test)', (t: any) => {
	let fixture = new Fixture('tmpdir');
	let binderName:string = '////testdb';

	try {
		let adb = new NotesDB({
			binderName: binderName,
			root: fixture.dir
		});
		t.fail(adb.toString());
	} catch (err) {
		t.is(err.message, `Invalid binder name '${binderName}'.  Can only use '-\\.+@_!$&0-9a-zA-Z '.`);
		t.pass(err.message);
	}
	t.end();
});

test('Create a binder with a bad initial section name', async (t: any) => {
	let fixture = new Fixture('empty-db');
	let notesDB = new NotesDB({
		root: fixture.dir
	});
	let binderName: string = '////Test1';

	validateDB(notesDB, 'sampledb', fixture.dir, notesDB.initialized, t);

	await notesDB.create(binderName)
		.then((adb: NotesDB) => {
			t.fail(adb.toString());
		})
		.catch((err: string) => {
			t.is(err, `Invalid section name '${binderName}'.  Can only use '-\\.+@_!$&0-9a-zA-Z '.`);
			t.pass(err);
		});
});

test('Open existing database with defaultConfigFile location', async (t: any) => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	// Check for sections
	t.true(adb.hasSection({section: 'Default'}));
	t.true(adb.hasSection({section: 'Test1'}));
	t.true(adb.hasSection({section: 'Test2'}));

	// Check for notebooks
	t.true(adb.hasNotebook({notebook: 'Default', section: 'Default'}));
	t.true(adb.hasNotebook({notebook: 'notebook1', section: 'Default'}));
	t.true(adb.hasNotebook({notebook: 'Default', section: 'Test1'}));
	t.true(adb.hasNotebook({notebook: 'Default', section: 'Test2'}));

	// Check for artifacts within notebooks
	let artifact = Artifact.factory('fields', {
		section: 'Default',
		notebook: 'Default',
		filename: 'test1.txt'
	});
	t.true(adb.hasArtifact(artifact));

	artifact = Artifact.factory('fields', {
		section: 'Default',
		notebook: 'notebook1',
		filename: 'test2.txt'
	});
	t.true(adb.hasArtifact(artifact));

	artifact = Artifact.factory('fields', {
		section: 'Test1',
		notebook: 'Default',
		filename: 'test3.txt'
	});
	t.true(adb.hasArtifact(artifact));

	artifact = Artifact.factory('fields', {
		section: 'Test2',
		notebook: 'Default',
		filename: 'test4.txt'
	});
	t.true(adb.hasArtifact(artifact));

	await adb.shutdown()
		.then((msg: string) => {
			t.is(msg, 'The database is shutdown.')
		})
		.catch((err: string) => {
			t.fail(`${t.title}: ${err}`);
		});
});

test.cb('Try to load existing database with missing config file (negative test)', (t: any) => {
	let fixture = new Fixture('missing-db-config');

	try {
		let adb = new NotesDB({
			root: fixture.dir
		});
		t.fail(adb.toString());
	} catch (err) {
		t.is(err.message, `Can't find notesdb configuration: badconfigfile.`);
		t.pass(err.message);
	}
	t.end();
});

test.cb('Try to load existing database with missing root directory (negative test)', (t: any) => {
	let fixture = new Fixture('missing-db-root');

	try {
		let adb = new NotesDB({
			root: fixture.dir
		});
		t.fail(adb.toString());
	} catch (err) {
		t.is(err.message, `No notesdb located @ badrootdirsampledb.`);
		t.pass(err.message);
	}
	t.end();
});

test.cb('Try to create a database with a missing dbdir in the config (negative test)', (t: any) => {
	let fixture = new Fixture('missing-db-dbdir');

	try {
		let adb = new NotesDB({
			root: fixture.dir
		});
		t.fail(adb.toString());
	} catch (err) {
		t.is(err.message, `The database directory is missing from configuration.`);
		t.pass(err.message);
	}
	t.end();
});

test('Test trying to save a bad configuration file (negative test)', async (t: any) => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);
	adb.config.configFile = '';  // destroy config reference

	await adb.save()
		.then(adb => {
			t.fail(adb.toString());
		})
		.catch(err => {
			t.is(err, `ENOENT: no such file or directory, open ''`);
			t.pass(err.message);
		});
});

test('Test trying to save a bad metadata file (negative test)', async (t: any) => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);
	adb.config.metaFile = '';  // destroy config reference

	await adb.save()
		.then(adb => {
			t.fail(adb.toString());
		})
		.catch(err => {
			t.is(err, `ENOENT: no such file or directory, open ''`);
			t.pass(err.message);
		});
});

test('Test the timed save facility', async (t: any) => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir,
		saveInterval: 1000
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	await wait(3)
		.then(() => {
			t.true(adb.timedSave);
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(`${t.title}: ${err}`);
		});
});

test('Test the reload function', async (t: any) => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir,
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	let filename = 'outside.txt';
	let data = 'Test outside data file';
	let lookup: IArtifactSearch = {
		section: 'Default',
		notebook: 'Default',
		filename: filename
	};

	t.true(adb.initialized);
	t.false(adb.hasArtifact(lookup));

	fs.writeFileSync(path.join(adb.config.dbdir, 'Default', 'Default', filename), data);

	await adb.reload()
		.then((adb: NotesDB) => {
			t.true(adb.hasArtifact(lookup));
			return adb.get(lookup)
		})
		.then((artifact: Artifact) => {
			t.is(artifact.buf, data);
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(`${t.title}: ${err}`);
		});
});

test('Try to add an empty item to an existing database', async (t: any) => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	await adb.add({})
		.then((artifact: Artifact) => {
			t.fail(artifact.toString())
		})
		.catch((err: string) => {
			t.is(err, 'Trying to add invalid artifact to DB');
			t.pass(err);
		});
});

test.cb('Test has functions for NotesDB', (t: any) => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	// Successful tests
	t.true(adb.hasSection({section: 'Test1'}));
	t.true(adb.hasNotebook({section: 'Test1', notebook: 'Default'}));
	t.true(adb.hasArtifact({section: 'Test1', notebook: 'Default', filename: 'test3.txt'}));

	// Failure tests
	t.false(adb.hasSection({section: 'blah'}));
	t.false(adb.hasSection({section: 'blah'}, 'badarea'));
	t.false(adb.hasNotebook({section: 'Test1', notebook: 'blah'}));
	t.false(adb.hasNotebook({section: 'blah', notebook: 'blah'}));
	t.false(adb.hasArtifact({section: 'Test1', notebook: 'Default', filename: 'blah.txt'}));
	t.false(adb.hasArtifact({section: 'Test1', notebook: 'blah', filename: 'blah.txt'}));
	t.false(adb.hasArtifact({section: 'blah', notebook: 'blah', filename: 'blah.txt'}));

	t.end();
});

test.cb('Test simple database with additional ignored directories', (t: any) => {
	let fixture = new Fixture('simple-db-with-ignored');
	let adb = new NotesDB({
		root: fixture.dir,
		ignore: ['Attachments', 'Images']
	});
	let l: string[] = ['Test1', 'Test2'];

	let sections: string[] = adb.sections();
	t.is(sections.length, 2);
	for (let section of sections) {
		t.true(l.indexOf(section) !== -1);
	}

	t.true(fs.existsSync(path.join(adb.config.dbdir, 'Attachments')));
	t.true(fs.existsSync(path.join(adb.config.dbdir, 'Images')));
	t.true(fs.existsSync(path.join(adb.config.dbdir, 'Test1')));
	t.true(fs.existsSync(path.join(adb.config.dbdir, 'Test2')));

	t.end();
});
