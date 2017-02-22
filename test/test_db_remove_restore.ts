'use strict';

import {test} from 'ava';
import * as fs from 'fs-extra';
import * as _ from 'lodash';
import * as path from 'path';
import {IArtifactSearch} from '../lib/artifact';
import {Fixture} from 'util.fixture';
import {NotesDB} from '../index';
import {validateDB} from './helpers';

const emptyDir = require('empty-dir');

test.after.always((t: any) => {
	console.log('final cleanup: test_db_remove');
	let directories = Fixture.cleanup();
	directories.forEach((directory: string) => {
		t.false(fs.existsSync(directory));
	});
});

test('Try to remove an artifact from the database and then restore it', async (t: any) => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	let lookup: IArtifactSearch = {
		section: 'Test2',
		notebook: 'Default',
		filename: 'test4.txt'
	};
	let artifactName: string = path.join(adb.config.dbdir, 'Trash', lookup.section, lookup.notebook, lookup.filename);

	await adb.remove(lookup)
		.then((filename: string) => {
			t.false(adb.hasArtifact(lookup));
			t.true(fs.existsSync(filename));
			t.is(artifactName, filename);

			return adb.restore(lookup);
		})
		.then((filename: string) => {
			t.true(adb.hasArtifact(lookup));
			t.false(fs.existsSync(artifactName));
			t.true(fs.existsSync(filename));
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(`${t.title}: ${err}`);
		});
});

test('Try to remove a notebook from the binder and then restore it', async (t: any) => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	let lookup: IArtifactSearch = {
		section: 'Test2',
		notebook: 'Default'
	};
	let notebookName: string = path.join(adb.config.dbdir, 'Trash', lookup.section, lookup.notebook);

	await adb.remove(lookup)
		.then((filename: string) => {
			t.false(adb.hasNotebook({notebook: lookup.notebook, section: lookup.section}));
			t.true(fs.existsSync(filename));
			t.is(notebookName, filename);

			return adb.restore(lookup);
		})
		.then((filename: string) => {
			t.true(adb.hasNotebook({notebook: lookup.notebook, section: lookup.section}));
			t.false(fs.existsSync(notebookName));
			t.true(fs.existsSync(filename));
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(`${t.title}: ${err}`);
		});
});

test('Try to remove a section from the binder and restore it', async (t: any) => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	let lookup: IArtifactSearch = {
		section: 'Test2'
	};
	let sectionName = path.join(adb.config.dbdir, 'Trash', lookup.section);

	await adb.remove(lookup)
		.then((filename: string) => {
			t.false(adb.hasSection({section: lookup.section}));
			t.true(fs.existsSync(filename));
			t.is(sectionName, filename);

			return adb.restore(lookup)
		})
		.then((filename: string) => {
			t.true(adb.hasSection({section: lookup.section}));
			t.false(fs.existsSync(sectionName));
			t.true(fs.existsSync(filename));
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(`${t.title}: ${err}`);
		});
});

test('Try to restore a deleted item with a duplicate/collision', async (t: any) => {
	let fixture = new Fixture('duplicate-trash');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	let lookup: IArtifactSearch = {
		section: 'Test2',
		notebook: 'Default',
		filename: 'test4.txt'
	};
	let artifactName: string = path.join(adb.config.dbdir, lookup.section, lookup.notebook, lookup.filename);

	await adb.restore(lookup)
		.then((filename: string) => {
			t.true(fs.existsSync(filename));

			// This name will have a timestamp, so we can't look for it
			// directly.  We find a substring of the base name without the
			// substring.
			t.true(filename.includes(artifactName));
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(`${t.title}: ${err}`);
		});
});

test('Try to remove an section with duplicate/collision in Trash', async (t: any) => {
	let fixture = new Fixture('duplicate-trash');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	let lookup: IArtifactSearch = {
		section: 'Test2'
	};
	let artifactName: string = path.join(adb.config.dbdir, 'Trash', lookup.section);

	await adb.remove(lookup)
		.then((filename: string) => {
			t.true(filename.startsWith(artifactName));
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(`${t.title}: ${err}`);
		});
});

test('Try to remove an notebook with duplicate/collision in Trash', async (t: any) => {
	let fixture = new Fixture('duplicate-trash');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	let lookup: IArtifactSearch = {
		section: 'Test2',
		notebook: 'Default'
	};
	let artifactName: string = path.join(adb.config.dbdir, 'Trash', lookup.section, lookup.notebook);

	await adb.remove(lookup)
		.then((filename: string) => {
			t.true(filename.startsWith(artifactName));
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(`${t.title}: ${err}`);
		});
});

test('Test the garbage empty process', async (t: any) => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir
	});

	await adb.emptyTrash()
		.then((adb: NotesDB) => {
			t.true(_.isEmpty(adb.schema.trash));
			t.true(emptyDir.sync(adb.config.trash));

			return adb.remove({
				'section': 'Test2'
			});
		})
		.then((filename: string) => {
			t.true(fs.existsSync(filename));
			return adb.emptyTrash();
		})
		.then((adb: NotesDB) => {
			t.true(_.isEmpty(adb.schema.trash));
			t.true(emptyDir.sync(adb.config.trash));
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(`${t.title}: ${err}`);
		});
});

test('Test garbage empty with bad trash directory', async (t: any) => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir
	});

	adb.config.trash = 'alksjdglaksdjgaaslkdjg';

	await adb.emptyTrash()
		.then((adb: NotesDB) => {
			t.fail(adb);
		})
		.catch((err: string) => {
			t.is(err, `Invalid trash directory, no empty: ${adb.config.trash}`);
			t.pass(err);
		});
});

test(`Try to restore artifact that doesn't exists`, async (t: any) => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	let lookup: IArtifactSearch = {
		section: 'Test2',
		notebook: 'Default',
		filename: 'asdfasdgadsgadf'
	};
	let info: string = `${lookup.section}|${lookup.notebook}|${lookup.filename}`;

	await adb.restore(lookup)
		.then((filename: string) => {
			t.fail(filename);
		})
		.catch((err: string) => {
			t.is(err, `This artifact doesn't exist in Trash and can't be restored: ${info}`);
			t.pass(err);
		});
});
