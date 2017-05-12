'use strict';

import test from 'ava';
import * as fs from 'fs-extra';
import * as path from 'path';
import {Fixture} from 'util.fixture';
import {Artifact, Binder} from '../index';
import {ArtifactType, IArtifactSearch} from '../lib/artifact';
import {cleanup, validateArtifact, validateDB} from './helpers';

test.after.always.cb(t => {
	cleanup(path.basename(__filename), t);
});

test('Renames an artifact (full path)', async t => {
	const fixture = new Fixture('simple-db');
	const adb = new Binder({
		root: fixture.dir
	});

	validateDB(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const src: IArtifactSearch = {
		section: 'Default',
		notebook: 'Default',
		filename: 'test1.txt'
	};

	const dst: IArtifactSearch = {
		section: 'Default',
		notebook: 'Default',
		filename: 'test1-copy.txt'
	};

	await adb.rename(src, dst)
		.then((dstArtifact: Artifact) => {

			validateArtifact(t, dstArtifact, {
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
			t.fail(err);
		});
});

test('Renames an artifact (different intermediate paths)', async t => {
	const fixture = new Fixture('simple-db');
	const adb = new Binder({
		root: fixture.dir
	});

	validateDB(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const src: IArtifactSearch = {
		section: 'Default',
		notebook: 'Default',
		filename: 'test1.txt'
	};

	const dst: IArtifactSearch = {
		section: 'Renamed Default',
		notebook: 'Renamed Notebook',
		filename: 'test1-copy.txt'
	};

	await adb.rename(src, dst)
		.then((dstArtifact: Artifact) => {

			validateArtifact(t, dstArtifact, {
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
			t.fail(err);
		});
});

test('Rename a section', async t => {
	const fixture = new Fixture('simple-db');
	const adb = new Binder({
		root: fixture.dir
	});

	validateDB(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const src: IArtifactSearch = {
		section: 'Default'
	};

	const dst: IArtifactSearch = {
		section: 'RenamedDefault'
	};

	await adb.rename(src, dst)
		.then((dstArtifact: Artifact) => {

			validateArtifact(t, dstArtifact, {
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
			t.fail(err);
		});
});

test('Rename a notebook', async t => {
	const fixture = new Fixture('simple-db');
	const adb = new Binder({
		root: fixture.dir
	});

	validateDB(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const src: IArtifactSearch = {
		section: 'Default',
		notebook: 'Default'
	};

	const dst: IArtifactSearch = {
		section: 'Default',
		notebook: 'Renamed Notebook'
	};

	await adb.rename(src, dst)
		.then((dstArtifact: Artifact) => {

			validateArtifact(t, dstArtifact, {
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
			t.false(err);
		});
});

test('Rename a section with the same name (negative test, with warning)', async t => {
	const fixture = new Fixture('simple-db');
	const adb = new Binder({
		root: fixture.dir
	});

	validateDB(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const src: IArtifactSearch = {
		section: 'Default'
	};

	const dst: IArtifactSearch = {
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

test('Rename artifact to an invalid name type (negative test)', async t => {
	const fixture = new Fixture('simple-db');
	const adb = new Binder({
		root: fixture.dir
	});

	validateDB(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const src: IArtifactSearch = {
		section: 'Default'
	};

	const badSectionName = '////Default';
	const dst: IArtifactSearch = {
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

test('Perform rename where the src and dst types are a mismatch (negative test)', async t => {
	const fixture = new Fixture('simple-db');
	const adb = new Binder({
		root: fixture.dir
	});

	validateDB(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const src: IArtifactSearch = {
		section: 'Default'
	};

	const dst: IArtifactSearch = {
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
