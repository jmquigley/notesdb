'use strict';

import {test} from 'ava';
import * as fs from 'fs-extra';
import * as path from 'path';
import {Fixture} from 'util.fixture';
import {Artifact} from '../lib/artifact';
import {NotesDB} from '../lib/notesdb';
import {validateDB} from './helpers';

test.after.always((t: any) => {
	console.log('final cleanup: test_db_sections');
	let directories = Fixture.cleanup();
	directories.forEach((directory: string) => {
		t.false(fs.existsSync(directory));
	});
});

test.cb('Try to get sections from an unitialized database', (t: any) => {
	let fixture = new Fixture('simple-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let adb = new NotesDB({
		configFile: configFile
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

test('Create a new section within an existing database', async (t: any) => {
	let fixture = new Fixture('simple-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let notesDB = new NotesDB({
		configFile: configFile
	});

	validateDB(notesDB, configFile, 'sampledb', fixture.dir, notesDB.initialized, t);

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
				'Test3'
			];

			l.forEach((name: string) => {
				t.true(adb.hasSection({section: name}));
			});

			t.true(fs.existsSync(path.join(adb.config.dbdir, 'Test3')));
		})
		.catch((err: string) => {
			t.fail(`${this.name}: ${err}`);
		});
});

test('Try to create a section that already exists within a database (negative test)', async (t: any) => {
	let fixture = new Fixture('simple-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let notesDB = new NotesDB({
		configFile: configFile
	});

	validateDB(notesDB, configFile, 'sampledb', fixture.dir, notesDB.initialized, t);

	let artifact = Artifact.factory('all', {
		section: 'Test1'
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

test('Try to create an artifact with bad section name (negative test)', async (t: any) => {
	let fixture = new Fixture('simple-db');
	let configFile = path.join(fixture.dir, 'config.json');
	let notesDB = new NotesDB({
		configFile: configFile
	});

	validateDB(notesDB, configFile, 'sampledb', fixture.dir, notesDB.initialized, t);

	let badSectionName = '////badSectionName';
	let artifact = Artifact.factory('all', {
		section: badSectionName
	});
	t.true(artifact instanceof Artifact);

	await notesDB.add(artifact)
		.then((adb: NotesDB) => {
			t.fail(adb.toString());
		})
		.catch((err: string) => {
			t.is(err, `Invalid section name '${badSectionName}'.  Can only use '-\\.+@_!$&0-9a-zA-Z '.`);
			t.pass(err);
		});
});
