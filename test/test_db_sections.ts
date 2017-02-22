'use strict';

import {test} from 'ava';
import * as fs from 'fs-extra';
import * as path from 'path';
import {Fixture} from 'util.fixture';
import {Artifact} from '../index';
import {NotesDB} from '../index';
import {validateDB, validateArtifact} from './helpers';

test.after.always((t: any) => {
	console.log('final cleanup: test_db_sections');
	let directories = Fixture.cleanup();
	directories.forEach((directory: string) => {
		t.false(fs.existsSync(directory));
	});
});

test.cb('Try to get sections from an unitialized database', (t: any) => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir
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
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	let artifact = Artifact.factory('fields', {section: 'Test3'});
	t.true(artifact instanceof Artifact);

	await adb.add(artifact)
		.then((artifact: Artifact) => {
			validateArtifact(artifact, 'Test3', '', '', t);
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
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(`${this.name}: ${err}`);
		});
});

test('Try to create a section that already exists within a database (negative test)', async (t: any) => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	let artifact = Artifact.factory('fields', {
		section: 'Test1'
	});
	t.true(artifact instanceof Artifact);

	await adb.add(artifact)
		.then((artifact: Artifact) => {
			validateArtifact(artifact, 'Test1', '', '', t);
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(`${this.name}: ${err}`);
		});
});

test('Try to create an artifact with bad section name (negative test)', async (t: any) => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	let badSectionName = '////badSectionName';
	let artifact = Artifact.factory('fields', {
		section: badSectionName
	});
	t.true(artifact instanceof Artifact);

	await adb.add(artifact)
		.then((artifact: Artifact) => {
			t.fail(artifact.toString());
		})
		.catch((err: string) => {
			t.is(err, `Invalid section name '${badSectionName}'.  Can only use '-\\.+@_!$&0-9a-zA-Z '.`);
			t.pass(err);
		});
});
