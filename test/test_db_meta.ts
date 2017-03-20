'use strict';

import * as assert from 'assert';
import * as fs from 'fs-extra';
import * as path from 'path';
import {Fixture} from 'util.fixture';
import {waitPromise} from 'util.wait';
import {Artifact, NotesDB} from '../index';
import {ArtifactType, IArtifactSearch} from '../lib/artifact';
import {validateArtifact, validateDB} from './helpers';

describe(path.basename(__filename), () => {

	// after(() => {
	// 	debug('final cleanup: test_db_meta');
	// 	let directories = Fixture.cleanup();
	// 	directories.forEach((directory: string) => {
	// 		assert(!fs.existsSync(directory));
	// 	});
	// });

	it('Get an existing artifact from the schema', async() => {
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
		let metaPath: string = `${lookup.section}${path.sep}${lookup.notebook}${path.sep}${lookup.filename}`;

		await adb.get(lookup)
			.then((artifact: Artifact) => {
				validateArtifact(artifact, {
					section: lookup.section,
					notebook: lookup.notebook,
					filename: lookup.filename,
					type: ArtifactType.SNA
				});
				assert.equal(artifact.buf, 'Test File #1\n');
				assert(artifact.loaded);

				let tags = artifact.tags;
				let l = ['A', 'B'];

				l.forEach((tag: string) => {
					assert(tags.indexOf(tag) !== -1);
				});

				artifact.addTag('C');
				return adb;
			})
			.then(adb.shutdown)
			.then((msg: string) => {
				assert.equal(msg, 'The database is shutdown.');

				let metaFile = path.join(adb.config.configRoot, 'meta.json');
				let metadata = JSON.parse(fs.readFileSync(metaFile).toString());

				let l = ['A', 'B', 'C'];

				l.forEach((tag: string) => {
					assert(metadata[metaPath].tags.indexOf(tag) !== -1);
				});
			})
			.catch((err: string) => {
				assert(false, err);
			});
	});

	it('Test artifact update time change after change', async () => {
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
		let before: string = JSON.stringify(adb.meta, null, '\t');
		let after: string = '';

		await adb.get(lookup)
			.then((artifact: Artifact) => {
				validateArtifact(artifact, {
					section: lookup.section,
					notebook: lookup.notebook,
					filename: lookup.filename,
					type: ArtifactType.SNA
				});
				assert.equal(artifact.buf, 'Test File #1\n');
				return waitPromise(3, artifact);  // delay 3 seconds and return artifact
			})
			.then((artifact: Artifact) => {
				artifact.buf += 'Added Content';
				return adb;
			})
			.then(adb.shutdown)
			.then((msg: string) => {
				assert.equal(msg, 'The database is shutdown.');
				let metaFile = path.join(adb.config.configRoot, 'meta.json');
				after = JSON.parse(fs.readFileSync(metaFile).toString());
				assert(before !== after);

				let data: string = fs.readFileSync(path.join(adb.config.dbdir,
				lookup.section, lookup.notebook, lookup.filename)).toString();

				assert.equal(data, 'Test File #1\nAdded Content');
			})
			.catch((err: string) => {
				assert(false, err);
			});
	});
});
