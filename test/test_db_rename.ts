'use strict';

import * as assert from 'assert';
import * as fs from 'fs-extra';
import * as path from 'path';
import {Fixture} from 'util.fixture';
import {Artifact, NotesDB} from '../index';
import {ArtifactType, IArtifactSearch} from '../lib/artifact';
import {validateArtifact, validateDB} from './helpers';

describe(path.basename(__filename), () => {

	// after(() => {
	// 	debug('final cleanup: test_db_rename');
	// 	let directories = Fixture.cleanup();
	// 	directories.forEach((directory: string) => {
	// 		assert(!fs.existsSync(directory));
	// 	});
	// });

	it('Renames an artifact (full path)', async () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

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

				validateArtifact(dstArtifact, {
					section: 'Default',
					notebook: 'Default',
					filename: 'test1-copy.txt',
					type: ArtifactType.SNA
				});

				assert(fs.existsSync(dstArtifact.absolute()));
				assert(!fs.existsSync(path.join(adb.config.dbdir, src.section, src.notebook, src.filename)));
				return adb;
			})
			.then(adb.shutdown)
			.catch((err: string) => {
				assert(false, err);
			});
	});

	it('Renames an artifact (different intermediate paths)', async () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

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

				validateArtifact(dstArtifact, {
					section: 'Renamed Default',
					notebook: 'Renamed Notebook',
					filename: 'test1-copy.txt',
					type: ArtifactType.SNA
				});

				assert(fs.existsSync(dstArtifact.absolute()));
				assert(!fs.existsSync(path.join(adb.config.dbdir, src.section, src.notebook, src.filename)));
				return adb;
			})
			.then(adb.shutdown)
			.catch((err: string) => {
				assert(false, err);
			});
	});

	it('Rename a section', async () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		let src: IArtifactSearch = {
			section: 'Default'
		};

		let dst: IArtifactSearch = {
			section: 'RenamedDefault'
		};

		await adb.rename(src, dst)
			.then((dstArtifact: Artifact) => {

				validateArtifact(dstArtifact, {
					section: 'RenamedDefault',
					notebook: '',
					filename: '',
					type: ArtifactType.S
				});

				assert(fs.existsSync(dstArtifact.absolute()));
				assert(!fs.existsSync(path.join(adb.config.dbdir, src.section)));
				return adb;
			})
			.then(adb.shutdown)
			.catch((err: string) => {
				assert(false, err);
			});
	});

	it('Rename a notebook', async () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

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

				validateArtifact(dstArtifact, {
					section: 'Default',
					notebook: 'Renamed Notebook',
					filename: '',
					type: ArtifactType.SN
				});

				assert(fs.existsSync(dstArtifact.absolute()));
				assert(!fs.existsSync(path.join(adb.config.dbdir, src.section, src.notebook)));
				return adb;
			})
			.then(adb.shutdown)
			.catch((err: string) => {
				assert(false, err);
			});
	});

	it('Rename a section with the same name (negative test, with warning)', async () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		let src: IArtifactSearch = {
			section: 'Default'
		};

		let dst: IArtifactSearch = {
			section: 'Default'
		};

		await adb.rename(src, dst)
			.then((dstArtifact: Artifact) => {
				assert(false, dstArtifact.absolute());
			})
			.catch((err: string) => {
				assert.equal(err, 'No difference between artifacts in rename request');
			});
	});

	it('Rename artifact to an invalid name type (negative test)', async () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		let src: IArtifactSearch = {
			section: 'Default'
		};

		let badSectionName = '////Default';
		let dst: IArtifactSearch = {
			section: badSectionName
		};

		await adb.rename(src, dst)
			.then((dstArtifact: Artifact) => {
				assert(false, dstArtifact.absolute());
			})
			.catch((err: string) => {
				assert.equal(err, `Invalid section name '${badSectionName}'.  Can only use '-\\.+@_!$&0-9a-zA-Z '.`);
			});
	});

	it('Perform rename where the src and dst types are a mismatch (negative test)', async () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		let src: IArtifactSearch = {
			section: 'Default'
		};

		let dst: IArtifactSearch = {
			section: 'Default',
			notebook: 'Default'
		};

		await adb.rename(src, dst)
			.then((dstArtifact: Artifact) => {
				assert(false, dstArtifact.absolute());
			})
			.catch((err: string) => {
				assert.equal(err, 'SRC artifact type does not match DST');
			});
	});
});
