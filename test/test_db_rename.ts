'use strict';

import {test} from 'ava';
import * as path from 'path';
import * as fs from 'fs-extra';
import {Fixture} from 'util.fixture';
import {Artifact} from '../index';
import {NotesDB} from '../index';
import {validateDB, validateArtifact} from './helpers';
import {IArtifactSearch, ArtifactType} from '../lib/artifact';

test.after.always((t: any) => {
	console.log('final cleanup: test_db_rename');
	let directories = Fixture.cleanup();
	directories.forEach((directory: string) => {
		t.false(fs.existsSync(directory));
	});
});

test('Renames an artifact (full path)', async (t: any) => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	let src: IArtifactSearch = {
		section: 'Default',
		notebook: 'Default',
		filename: 'test1.txt'
	};

	let dst: IArtifactSearch = {
		section: 'Default',
		notebook: 'Default',
		filename: 'test1-copy.txt'
	};

	await adb.rename(src, dst)
		.then((dstArtifact: Artifact) => {

			validateArtifact(dstArtifact, t, {
				section: 'Default',
				notebook: 'Default',
				filename: 'test1-copy.txt',
				type: ArtifactType.SNA
			});

			t.true(fs.existsSync(dstArtifact.absolute()));
			t.false(fs.existsSync(path.join(adb.config.dbdir, src.section, src.notebook, src.filename)));
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(`${t.title}: ${err}`);
		});
});

test('Renames an artifact (different intermediate paths)', async (t: any) => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	let src: IArtifactSearch = {
		section: 'Default',
		notebook: 'Default',
		filename: 'test1.txt'
	};

	let dst: IArtifactSearch = {
		section: 'Renamed Default',
		notebook: 'Renamed Notebook',
		filename: 'test1-copy.txt'
	};

	await adb.rename(src, dst)
		.then((dstArtifact: Artifact) => {

			validateArtifact(dstArtifact, t, {
				section: 'Renamed Default',
				notebook: 'Renamed Notebook',
				filename: 'test1-copy.txt',
				type: ArtifactType.SNA
			});

			t.true(fs.existsSync(dstArtifact.absolute()));
			t.false(fs.existsSync(path.join(adb.config.dbdir, src.section, src.notebook, src.filename)));
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(`${t.title}: ${err}`);
		});
});

test('Rename a section', async (t: any) => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	let src: IArtifactSearch = {
		section: 'Default',
	};

	let dst: IArtifactSearch = {
		section: 'RenamedDefault',
	};

	await adb.rename(src, dst)
		.then((dstArtifact: Artifact) => {

			validateArtifact(dstArtifact, t, {
				section: 'RenamedDefault',
				notebook: '',
				filename: '',
				type: ArtifactType.S
			});

			t.true(fs.existsSync(dstArtifact.absolute()));
			t.false(fs.existsSync(path.join(adb.config.dbdir, src.section)));
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(`${t.title}: ${err}`);
		});
});

test('Rename a notebook', async (t: any) => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	let src: IArtifactSearch = {
		section: 'Default',
		notebook: 'Default'
	};

	let dst: IArtifactSearch = {
		section: 'Default',
		notebook: 'Renamed Notebook'
	};

	await adb.rename(src, dst)
		.then((dstArtifact: Artifact) => {

			validateArtifact(dstArtifact, t, {
				section: 'Default',
				notebook: 'Renamed Notebook',
				filename: '',
				type: ArtifactType.SN
			});

			t.true(fs.existsSync(dstArtifact.absolute()));
			t.false(fs.existsSync(path.join(adb.config.dbdir, src.section, src.notebook)));
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(`${t.title}: ${err}`);
		});
});

test('Rename a section with the same name (negative test, with warning)', async (t: any) => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	let src: IArtifactSearch = {
		section: 'Default'
	};

	let dst: IArtifactSearch = {
		section: 'Default'
	};

	await adb.rename(src, dst)
		.then((dstArtifact: Artifact) => {
			t.fail(dstArtifact.absolute());
		})
		.catch((err: string) => {
			t.is(err, 'No difference between artifacts in rename request');
		});
});

test('Rename artifact to an invalid name type (negative test)', async (t: any) => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	let src: IArtifactSearch = {
		section: 'Default'
	};

	let badSectionName = '////Default';
	let dst: IArtifactSearch = {
		section: badSectionName
	};

	await adb.rename(src, dst)
		.then((dstArtifact: Artifact) => {
			t.fail(dstArtifact.absolute());
		})
		.catch((err: string) => {
			t.is(err, `Invalid section name '${badSectionName}'.  Can only use '-\\.+@_!$&0-9a-zA-Z '.`);
		});
});


test('Perform rename where the src and dst types are a mismatch (negative test)', async (t: any) => {
	let fixture = new Fixture('simple-db');
	let adb = new NotesDB({
		root: fixture.dir
	});

	validateDB(adb, 'sampledb', fixture.dir, adb.initialized, t);

	let src: IArtifactSearch = {
		section: 'Default'
	};

	let dst: IArtifactSearch = {
		section: 'Default',
		notebook: 'Default'
	};

	await adb.rename(src, dst)
		.then((dstArtifact: Artifact) => {
			t.fail(dstArtifact.absolute());
		})
		.catch((err: string) => {
			t.is(err, 'SRC artifact type does not match DST');
		});
});
