'use strict';

import test from 'ava';
import * as fs from 'fs-extra';
import * as _ from 'lodash';
import * as path from 'path';
import {Fixture} from 'util.fixture';
import {join} from 'util.join';
import {Artifact, Binder} from '../index';
import {IArtifactSearch} from '../lib/artifact';
import {cleanup, validateDB} from './helpers';

const emptyDir = require('empty-dir');

test.after.always.cb(t => {
	cleanup(path.basename(__filename), t);
});

test('Send an item to the trash from the database and then restore it', async t => {
	const fixture = new Fixture('simple-db');
	const adb = new Binder({
		root: fixture.dir
	});

	validateDB(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const lookup: IArtifactSearch = {
		section: 'Test2',
		notebook: 'Default',
		filename: 'test4.txt'
	};
	const artifactName: string = join(adb.config.dbdir, 'Trash', lookup.section, lookup.notebook, lookup.filename);

	await adb.trash(lookup)
		.then((artifact: Artifact) => {
			t.false(adb.hasArtifact(lookup));
			t.true(fs.existsSync(artifactName));
			t.is(artifactName, artifact.absolute());

			return adb.restore(lookup);
		})
		.then((artifact: Artifact) => {
			t.true(adb.hasArtifact(lookup));
			t.false(fs.existsSync(artifactName));
			t.true(fs.existsSync(artifact.absolute()));
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(err);
		});
});

test('Send a notebook in the binder to the trash and then restore it', async t => {
	const fixture = new Fixture('simple-db');
	const adb = new Binder({
		root: fixture.dir
	});

	validateDB(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const lookup: IArtifactSearch = {
		section: 'Test2',
		notebook: 'Default'
	};
	const notebookName: string = join(adb.config.dbdir, 'Trash', lookup.section, lookup.notebook);

	await adb.trash(lookup)
		.then((artifact: Artifact) => {
			t.false(adb.hasNotebook({notebook: lookup.notebook, section: lookup.section}));
			t.true(fs.existsSync(artifact.absolute()));
			t.is(notebookName, artifact.absolute());

			return adb.restore(lookup);
		})
		.then((artifact: Artifact) => {
			t.true(adb.hasNotebook({notebook: lookup.notebook, section: lookup.section}));
			t.false(fs.existsSync(notebookName));
			t.true(fs.existsSync(artifact.absolute()));
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(err);
		});
});

test('Try to send a section from the binder to the trash and restore it', async t => {
	const fixture = new Fixture('simple-db');
	const adb = new Binder({
		root: fixture.dir
	});

	validateDB(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const lookup: IArtifactSearch = {
		section: 'Test2'
	};
	const sectionName = path.join(adb.config.dbdir, 'Trash', lookup.section);

	await adb.trash(lookup)
		.then((artifact: Artifact) => {
			t.false(adb.hasSection({section: lookup.section}));
			t.true(fs.existsSync(artifact.absolute()));
			t.is(sectionName, artifact.absolute());

			return adb.restore(lookup);
		})
		.then((artifact: Artifact) => {
			t.true(adb.hasSection({section: lookup.section}));
			t.false(fs.existsSync(sectionName));
			t.true(fs.existsSync(artifact.absolute()));
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(err);
		});
});

test('Try to restore a deleted item with a duplicate/collision', async t => {
	const fixture = new Fixture('duplicate-trash');
	const adb = new Binder({
		root: fixture.dir
	});

	validateDB(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const lookup: IArtifactSearch = {
		section: 'Test2',
		notebook: 'Default',
		filename: 'test4.txt'
	};
	const artifactName: string = join(adb.config.dbdir, lookup.section, lookup.notebook, lookup.filename);

	await adb.restore(lookup)
		.then((artifact: Artifact) => {
			t.true(fs.existsSync(artifact.absolute()));

			// This name will have a timestamp, so we can't look for it
			// directly.  We find a substring of the base name without the
			// substring.
			t.true(artifact.absolute().includes(artifactName));
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(err);
		});
});

test('Try to send a section with duplicate/collision to the Trash', async t => {
	const fixture = new Fixture('duplicate-trash');
	const adb = new Binder({
		root: fixture.dir
	});

	validateDB(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const lookup: IArtifactSearch = {
		section: 'Test2'
	};
	const artifactName: string = join(adb.config.dbdir, 'Trash', lookup.section);

	await adb.trash(lookup)
		.then((artifact: Artifact) => {
			t.true(artifact.absolute().startsWith(artifactName));
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(err);
		});
});

test('Try to send a notebook with duplicate/collision to the Trash', async t => {
	const fixture = new Fixture('duplicate-trash');
	const adb = new Binder({
		root: fixture.dir
	});

	validateDB(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const lookup: IArtifactSearch = {
		section: 'Test2',
		notebook: 'Default'
	};
	const artifactName: string = join(adb.config.dbdir, 'Trash', lookup.section, lookup.notebook);

	await adb.trash(lookup)
		.then((artifact: Artifact) => {
			t.true(artifact.absolute().startsWith(artifactName));
			return adb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(err);
		});
});

test('Test the garbage empty process', async t => {
	const fixture = new Fixture('simple-db');
	const adb = new Binder({
		root: fixture.dir
	});

	await adb.emptyTrash()
		.then((padb: Binder) => {
			t.true(_.isEmpty(padb.schema.trash));
			t.true(emptyDir.sync(padb.config.trash));

			return padb.trash({
				section: 'Test2'
			});
		})
		.then((artifact: Artifact) => {
			t.true(fs.existsSync(artifact.absolute()));
			return adb.emptyTrash();
		})
		.then((padb: Binder) => {
			t.true(_.isEmpty(padb.schema.trash));
			t.true(emptyDir.sync(padb.config.trash));
			return padb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(err);
		});
});

test('Test garbage empty with bad trash directory', async t => {
	const fixture = new Fixture('simple-db');
	const adb = new Binder({
		root: fixture.dir
	});

	adb.config.trash = 'alksjdglaksdjgaaslkdjg';

	await adb.emptyTrash()
		.then((padb: Binder) => {
			t.fail(padb.toString());
		})
		.catch((err: string) => {
			t.is(err, `Invalid trash directory, no empty: ${adb.config.trash}`);
		});
});

test(`Try to restore artifact that doesn't exists`, async t => {
	const fixture = new Fixture('simple-db');
	const adb = new Binder({
		root: fixture.dir
	});

	validateDB(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const lookup: IArtifactSearch = {
		section: 'Test2',
		notebook: 'Default',
		filename: 'asdfasdgadsgadf'
	};
	const info: string = `${lookup.section}|${lookup.notebook}|${lookup.filename}`;

	await adb.restore(lookup)
		.then((artifact: Artifact) => {
			t.fail(artifact.toString());
		})
		.catch((err: string) => {
			t.is(err, `This artifact doesn't exist in Trash and can't be restored: ${info}`);
		});
});

test('Test immediate deletion of artifact from the schema', async t => {
	const fixture = new Fixture('simple-db');
	const adb = new Binder({
		root: fixture.dir
	});

	validateDB(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const lookup: IArtifactSearch = {
		section: 'Test2',
		notebook: 'Default',
		filename: 'test4.txt'
	};

	await adb.remove(lookup)
		.then((padb: Binder) => {
			t.false(padb.hasArtifact(lookup));
			t.false(fs.existsSync(join(padb.config.dbdir, lookup.section, lookup.notebook, lookup.filename)));
			return padb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(err);
		});
});

test('Test immediate deletion of notebook from the schema', async t => {
	const fixture = new Fixture('simple-db');
	const adb = new Binder({
		root: fixture.dir
	});

	validateDB(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const lookup: IArtifactSearch = {
		section: 'Test2',
		notebook: 'Default'
	};

	await adb.remove(lookup)
		.then((padb: Binder) => {
			t.false(padb.hasNotebook(lookup));
			t.false(fs.existsSync(join(padb.config.dbdir, lookup.section, lookup.notebook)));
			return padb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(err);
		});
});

test('Test immediate deletion of section from the schema', async t => {
	const fixture = new Fixture('simple-db');
	const adb = new Binder({
		root: fixture.dir
	});

	validateDB(t, adb, 'sampledb', fixture.dir, adb.initialized);

	const lookup: IArtifactSearch = {
		section: 'Test2'
	};

	await adb.remove(lookup)
		.then((padb: Binder) => {
			t.false(padb.hasNotebook(lookup));
			t.false(fs.existsSync(join(padb.config.dbdir, lookup.section)));
			return padb;
		})
		.then(adb.shutdown)
		.catch((err: string) => {
			t.fail(err);
		});
});
