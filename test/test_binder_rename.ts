'use strict';

import test from 'ava';
import * as fs from 'fs-extra';
import * as path from 'path';
import {Fixture} from 'util.fixture';
import {Artifact, Binder} from '../index';
import {ArtifactSearch, ArtifactType} from '../lib/artifact';
import {cleanup, validateArtifact, validateBinder} from './helpers';

test.after.always(async t => {
	await cleanup(path.basename(__filename), t);
});

test('Renames an artifact (full path)', async t => {
	const fixture = new Fixture('simple-db');
	const adb = new Binder({
		root: fixture.dir
	});

	validateBinder(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const src: ArtifactSearch = {
		section: 'Default',
		notebook: 'Default',
		filename: 'test1.txt'
	};

	const dst: ArtifactSearch = {
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

	validateBinder(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const src: ArtifactSearch = {
		section: 'Default',
		notebook: 'Default',
		filename: 'test1.txt'
	};

	const dst: ArtifactSearch = {
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

	validateBinder(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const src: ArtifactSearch = {
		section: 'Default'
	};

	const dst: ArtifactSearch = {
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

	validateBinder(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const src: ArtifactSearch = {
		section: 'Default',
		notebook: 'Default'
	};

	const dst: ArtifactSearch = {
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

	validateBinder(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const src: ArtifactSearch = {
		section: 'Default'
	};

	const dst: ArtifactSearch = {
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

	validateBinder(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const src: ArtifactSearch = {
		section: 'Default'
	};

	const badSectionName = '////Default';
	const dst: ArtifactSearch = {
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

	validateBinder(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const src: ArtifactSearch = {
		section: 'Default'
	};

	const dst: ArtifactSearch = {
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
