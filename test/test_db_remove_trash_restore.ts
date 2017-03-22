'use strict';

import * as assert from 'assert';
import * as fs from 'fs-extra';
import * as _ from 'lodash';
import * as path from 'path';
import {Fixture} from 'util.fixture';
import {join} from 'util.join';
import {Artifact, NotesDB} from '../index';
import {IArtifactSearch} from '../lib/artifact';
import {validateDB} from './helpers';

const emptyDir = require('empty-dir');

describe(path.basename(__filename), () => {

	// after(() => {
	// 	debug('final cleanup: test_db_remove_trash_restore');
	// 	let directories = Fixture.cleanup();
	// 	directories.forEach((directory: string) => {
	// 		assert(!fs.existsSync(directory));
	// 	});
	// });

	it('Send an item to the trash from the database and then restore it', async () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		let lookup: IArtifactSearch = {
			section: 'Test2',
			notebook: 'Default',
			filename: 'test4.txt'
		};
		let artifactName: string = join(adb.config.dbdir, 'Trash', lookup.section, lookup.notebook, lookup.filename);

		await adb.trash(lookup)
			.then((artifact: Artifact) => {
				assert(!adb.hasArtifact(lookup));
				assert(fs.existsSync(artifactName));
				assert.equal(artifactName, artifact.absolute());

				return adb.restore(lookup);
			})
			.then((artifact: Artifact) => {
				assert(adb.hasArtifact(lookup));
				assert(!fs.existsSync(artifactName));
				assert(fs.existsSync(artifact.absolute()));
				return adb;
			})
			.then(adb.shutdown)
			.catch((err: string) => {
				assert(false, err);
			});
	});

	it('Send a notebook in the binder to the trash and then restore it', async () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		let lookup: IArtifactSearch = {
			section: 'Test2',
			notebook: 'Default'
		};
		let notebookName: string = join(adb.config.dbdir, 'Trash', lookup.section, lookup.notebook);

		await adb.trash(lookup)
			.then((artifact: Artifact) => {
				assert(!adb.hasNotebook({notebook: lookup.notebook, section: lookup.section}));
				assert(fs.existsSync(artifact.absolute()));
				assert.equal(notebookName, artifact.absolute());

				return adb.restore(lookup);
			})
			.then((artifact: Artifact) => {
				assert(adb.hasNotebook({notebook: lookup.notebook, section: lookup.section}));
				assert(!fs.existsSync(notebookName));
				assert(fs.existsSync(artifact.absolute()));
				return adb;
			})
			.then(adb.shutdown)
			.catch((err: string) => {
				assert(false, err);
			});
	});

	it('Try to send a section from the binder to the trash and restore it', async () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		let lookup: IArtifactSearch = {
			section: 'Test2'
		};
		let sectionName = path.join(adb.config.dbdir, 'Trash', lookup.section);

		await adb.trash(lookup)
			.then((artifact: Artifact) => {
				assert(!adb.hasSection({section: lookup.section}));
				assert(fs.existsSync(artifact.absolute()));
				assert.equal(sectionName, artifact.absolute());

				return adb.restore(lookup);
			})
			.then((artifact: Artifact) => {
				assert(adb.hasSection({section: lookup.section}));
				assert(!fs.existsSync(sectionName));
				assert(fs.existsSync(artifact.absolute()));
				return adb;
			})
			.then(adb.shutdown)
			.catch((err: string) => {
				assert(err);
			});
	});

	it('Try to restore a deleted item with a duplicate/collision', async () => {
		let fixture = new Fixture('duplicate-trash');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		let lookup: IArtifactSearch = {
			section: 'Test2',
			notebook: 'Default',
			filename: 'test4.txt'
		};
		let artifactName: string = join(adb.config.dbdir, lookup.section, lookup.notebook, lookup.filename);

		await adb.restore(lookup)
			.then((artifact: Artifact) => {
				assert(fs.existsSync(artifact.absolute()));

				// This name will have a timestamp, so we can't look for it
				// directly.  We find a substring of the base name without the
				// substring.
				assert(artifact.absolute().includes(artifactName));
				return adb;
			})
			.then(adb.shutdown)
			.catch((err: string) => {
				assert(false, err);
			});
	});

	it('Try to send a section with duplicate/collision to the Trash', async () => {
		let fixture = new Fixture('duplicate-trash');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		let lookup: IArtifactSearch = {
			section: 'Test2'
		};
		let artifactName: string = join(adb.config.dbdir, 'Trash', lookup.section);

		await adb.trash(lookup)
			.then((artifact: Artifact) => {
				assert(artifact.absolute().startsWith(artifactName));
				return adb;
			})
			.then(adb.shutdown)
			.catch((err: string) => {
				assert(false, err);
			});
	});

	it('Try to send a notebook with duplicate/collision to the Trash', async () => {
		let fixture = new Fixture('duplicate-trash');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		let lookup: IArtifactSearch = {
			section: 'Test2',
			notebook: 'Default'
		};
		let artifactName: string = join(adb.config.dbdir, 'Trash', lookup.section, lookup.notebook);

		await adb.trash(lookup)
			.then((artifact: Artifact) => {
				assert(artifact.absolute().startsWith(artifactName));
				return adb;
			})
			.then(adb.shutdown)
			.catch((err: string) => {
				assert(false, err);
			});
	});

	it('Test the garbage empty process', async () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir
		});

		await adb.emptyTrash()
			.then((padb: NotesDB) => {
				assert(_.isEmpty(padb.schema.trash));
				assert(emptyDir.sync(padb.config.trash));

				return padb.trash({
					section: 'Test2'
				});
			})
			.then((artifact: Artifact) => {
				assert(fs.existsSync(artifact.absolute()));
				return adb.emptyTrash();
			})
			.then((padb: NotesDB) => {
				assert(_.isEmpty(padb.schema.trash));
				assert(emptyDir.sync(padb.config.trash));
				return padb;
			})
			.then(adb.shutdown)
			.catch((err: string) => {
				assert(false, err);
			});
	});

	it('Test garbage empty with bad trash directory', async () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir
		});

		adb.config.trash = 'alksjdglaksdjgaaslkdjg';

		await adb.emptyTrash()
			.then((padb: NotesDB) => {
				assert(false, padb.toString());
			})
			.catch((err: string) => {
				assert.equal(err, `Invalid trash directory, no empty: ${adb.config.trash}`);
			});
	});

	it(`Try to restore artifact that doesn't exists`, async () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		let lookup: IArtifactSearch = {
			section: 'Test2',
			notebook: 'Default',
			filename: 'asdfasdgadsgadf'
		};
		let info: string = `${lookup.section}|${lookup.notebook}|${lookup.filename}`;

		await adb.restore(lookup)
			.then((artifact: Artifact) => {
				assert(false, artifact.toString());
			})
			.catch((err: string) => {
				assert.equal(err, `This artifact doesn't exist in Trash and can't be restored: ${info}`);
			});
	});

	it('Test immediate deletion of artifact from the schema', async () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		let lookup: IArtifactSearch = {
			section: 'Test2',
			notebook: 'Default',
			filename: 'test4.txt'
		};

		await adb.remove(lookup)
			.then((padb: NotesDB) => {
				assert(!padb.hasArtifact(lookup));
				assert(!fs.existsSync(join(padb.config.dbdir, lookup.section, lookup.notebook, lookup.filename)));
				return padb;
			})
			.then(adb.shutdown)
			.catch((err: string) => {
				assert(false, err);
			});
	});

	it('Test immediate deletion of notebook from the schema', async () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		let lookup: IArtifactSearch = {
			section: 'Test2',
			notebook: 'Default'
		};

		await adb.remove(lookup)
			.then((padb: NotesDB) => {
				assert(!padb.hasNotebook(lookup));
				assert(!fs.existsSync(join(padb.config.dbdir, lookup.section, lookup.notebook)));
				return padb;
			})
			.then(adb.shutdown)
			.catch((err: string) => {
				assert(false, err);
			});
	});

	it('Test immediate deletion of section from the schema', async () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		let lookup: IArtifactSearch = {
			section: 'Test2'
		};

		await adb.remove(lookup)
			.then((padb: NotesDB) => {
				assert(!padb.hasNotebook(lookup));
				assert(!fs.existsSync(join(padb.config.dbdir, lookup.section)));
				return padb;
			})
			.then(adb.shutdown)
			.catch((err: string) => {
				assert(false, err);
			});
	});
});
