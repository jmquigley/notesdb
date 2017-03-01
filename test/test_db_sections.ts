'use strict';

import * as assert from 'assert';
import * as fs from 'fs-extra';
import * as path from 'path';
import {Fixture} from 'util.fixture';
import {Artifact} from '../index';
import {NotesDB} from '../index';
import {debug, validateDB, validateArtifact} from './helpers';
import {ArtifactType} from '../lib/artifact';

describe('DB Sections', () => {

	after(() => {
		debug('final cleanup: test_db_sections');
		let directories = Fixture.cleanup();
		directories.forEach((directory: string) => {
			assert(!fs.existsSync(directory));
		});
	});

	it('Try to get sections from an unitialized database', () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir
		});

		adb.initialized = false;

		try {
			let sections = adb.sections();
			assert(false, sections.toString());
		} catch (err) {
			assert.equal(err.message, `Trying to retrieve sections from an unitialized database.`);
		}
	});

	it('Create a new section within an existing database', async () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		let artifact = Artifact.factory('fields', {section: 'Test3'});
		assert(artifact instanceof Artifact);

		await adb.add(artifact)
			.then((artifact: Artifact) => {
				validateArtifact(artifact, {
					section: 'Test3',
					type: ArtifactType.S
				});
				let sections = adb.sections();
				assert(sections instanceof Array);
				assert.equal(sections.length, 5);

				let l = [
					'Default',
					'Test1',
					'Test2',
					'Test3',
					'Section With Spaces'
				];

				l.forEach((name: string) => {
					assert(adb.hasSection({section: name}));
				});

				assert(fs.existsSync(path.join(adb.config.dbdir, 'Test3')));
				return adb;
			})
			.then(adb.shutdown)
			.catch((err: string) => {
				assert(false, err);
			});
	});

	it('Try to create a section that already exists within a database (negative test)', async () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		let artifact = Artifact.factory('fields', {
			section: 'Test1'
		});
		assert(artifact instanceof Artifact);

		await adb.add(artifact)
			.then((artifact: Artifact) => {
				validateArtifact(artifact, {
					section: 'Test1',
					type: ArtifactType.S
				});
				return adb;
			})
			.then(adb.shutdown)
			.catch((err: string) => {
				assert(false, err);
			});
	});

	it('Try to create an artifact with bad section name (negative test)', async () => {
		let fixture = new Fixture('simple-db');
		let adb = new NotesDB({
			root: fixture.dir
		});

		validateDB(adb, 'sampledb', fixture.dir, adb.initialized);

		let badSectionName = '////badSectionName';
		let artifact = Artifact.factory('fields', {
			section: badSectionName
		});
		assert(artifact instanceof Artifact);

		await adb.add(artifact)
			.then((artifact: Artifact) => {
				assert(false, artifact.toString());
			})
			.catch((err: string) => {
				assert.equal(err, `Invalid section name '${badSectionName}'.  Can only use '-\\.+@_!$&0-9a-zA-Z '.`);
			});
	});
})
