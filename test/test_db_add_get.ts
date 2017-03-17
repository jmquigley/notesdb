'use strict';

import * as assert from 'assert';
import * as fs from 'fs-extra';
import {Artifact} from '../index';
import {IArtifactSearch, ArtifactType} from '../lib/artifact';
import {Fixture} from 'util.fixture';
import {waitPromise} from 'util.wait';
import {NotesDB} from '../index';
import {debug, validateDB, validateArtifact} from './helpers';

describe('DB Add', () => {

	after(() => {
		debug('final cleanup: test_db_add');
		let directories = Fixture.cleanup();
		directories.forEach((directory: string) => {
			assert(!fs.existsSync(directory));
		});
	});

	it('Create a new artifact file within the database', async () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		let artifact = {
			section: 'Test3',
			notebook: 'notebook',
			filename: 'test file 1.txt'
		};

		await adb.add(artifact)
			.then((artifact: Artifact) => {
				validateArtifact(artifact, {
					section: 'Test3',
					notebook: 'notebook',
					filename: 'test file 1.txt',
					type: ArtifactType.SNA
				});
				return adb.saveArtifact(artifact);
			})
			.then((artifact: Artifact) => {
				assert(artifact.toString());
				return adb;
			})
			.then(adb.shutdown)
			.catch((err: string) => {
				assert(false, err);
			});
	});

	it('Try to add an artifact with a bad name to the database (negative test)', async () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		let badFileName = '////badfilename';
		let artifact = {
			section: 'Test3',
			notebook: 'notebook',
			filename: badFileName
		};

		await adb.add(artifact)
			.then((artifact: Artifact) => {
				assert(false, artifact.toString());
			})
			.catch((err: string) => {
				assert.equal(err, `Invalid filename name '${badFileName}'.  Can only use '-\\.+@_!$&0-9a-zA-Z '.`);
			});
	});

	it('Try to add a bad artifact to the database (negative test)', async () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		let artifact = Artifact.factory();
		artifact.type = 99;  // set an invalid type to force failure

		await adb.add(artifact)
			.then((artifact: Artifact) => {
				assert(false, artifact.toString());
			})
			.catch((err: string) => {
				assert.equal(err, 'Trying to add invalid artifact to DB');
			});
	});

	it('Try to create a null artifact (negative test)', async () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		await adb.add(null)
			.then((artifact: Artifact) => {
				assert(false, artifact.toString());
			})
			.catch((err: string) => {
				assert.equal(err, 'Trying to add invalid artifact to DB');
			});
	});

	it('Try to load a binder with a bad artifact name (negative test)', () => {
		let fixture = new Fixture('bad-db-artifact');
		let badFileName = '%%%%badfile.txt';

		try {
			let adb = new NotesDB({
				binderName: 'sampledb',
				root: fixture.dir
			});
			assert(false, adb.toString());
		} catch (err) {
			assert.equal(err.message, `Invalid filename name '${badFileName}'.  Can only use '-\\.+@_!$&0-9a-zA-Z '.`);
		}
	});

	it('Get an existing artifact from the schema', async () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		let lookup: IArtifactSearch = {
			section: 'Default',
			notebook: 'Default',
			filename: 'test1.txt'
		};

		await adb.get(lookup)
			.then((artifact: Artifact) => {
				assert.equal(artifact.buf, 'Test File #1\n');
				assert(artifact.loaded);

				// Retrieve the same artifact again to show it's indepotent
				// (and loaded).  This return is fed to the next "thenable"
				return adb.get(lookup);
			})
			.then((artifact: Artifact) => {
				assert.equal(artifact.buf, 'Test File #1\n');
				assert(artifact.loaded);
				return adb
			})
			.then(adb.shutdown)
			.catch((err: string) => {
				assert(false, err);
			});
	});

	it(`Try to retrieve an artifact that doesn't exist`, async () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		let lookup: IArtifactSearch = {
			section: 'Missing',
			notebook: 'Missing',
			filename: 'test1.txt'
		};

		await adb.get(lookup)
			.then((artifact: Artifact) => {
				assert(false, artifact.toString());
			})
			.catch((err: string) => {
				assert.equal(err, `Artifact doesn't exist: Missing|Missing|test1.txt`);
			});
	});

	it('Create a new artifact, update it, and call the save', async () => {
		let fixture = new Fixture('empty-db');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		let artifact = {
			section: 'Test1',
			notebook: 'notebook1',
			filename: 'somefile.txt'
		};

		let content: string = 'Adding content';
		await adb.add(artifact)
			.then((artifact: Artifact) => {
				assert(!artifact.isDirty());
				artifact.buf += content;
				assert(artifact.isDirty());
				return artifact;
			})
			.then(adb.saveArtifact)
			.then((artifact: Artifact) => {
				let data: string = fs.readFileSync(artifact.absolute()).toString();
				assert.equal(data, content);

				assert(!artifact.isDirty());
				artifact.buf += content;
				assert(artifact.isDirty());
				return artifact;
			})
			.then(adb.saveArtifact)
			.then((artifact: Artifact) => {
				let data: string = fs.readFileSync(artifact.absolute()).toString();
				assert.equal(data, `${content}${content}`);
				return adb;
			})
			.then(adb.shutdown)
			.catch((err: string) => {
				assert(false, err);
			});
	});

	it('Test the automatic ejection from recents list', async () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir,
			maxRecents: 1 // make the recents small
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		let ejected: Artifact = null;

		await adb.get({section: 'Default', notebook: 'Default', filename: 'test1.txt'})
			.then((artifact: Artifact) => {
				validateArtifact(artifact, {
					section: 'Default',
					notebook: 'Default',
					filename: 'test1.txt',
					type: ArtifactType.SNA
				});

				ejected = artifact;
				assert(!artifact.isDirty());
				artifact.buf += 'Content change';
				assert(artifact.isDirty());

				// This call should eject the first file from recents and save it.
				return adb.get({section: 'Default', notebook: 'notebook1', filename: 'test2.txt'});
			})
			.then((artifact: Artifact) => {
				validateArtifact(artifact, {
					section: 'Default',
					notebook: 'notebook1',
					filename: 'test2.txt',
					type: ArtifactType.SNA
				});

				// This wait allows the event loop to continue and process the
				// remove node event before moving on to the next thenable
				return waitPromise(3, adb.get({section: 'Test1', notebook: 'Default', filename: 'test3.txt'}));
			})
			.then((artifact: Artifact) => {
				validateArtifact(artifact, {
					section: 'Test1',
					notebook: 'Default',
					filename: 'test3.txt',
					type: ArtifactType.SNA
				});
				return adb;
			})
			.then((adb: NotesDB) => {
				assert.equal(adb.recents.length, 1);
				assert(!ejected.isDirty());
				let data: string = fs.readFileSync(ejected.absolute()).toString();
				assert.equal(data, 'Test File #1\nContent change');
				assert.equal(ejected.buf, data);
				return adb;
			})
			.then(adb.shutdown)
			.catch((err: string) => {
				assert(false, err);
			});
	});
});
