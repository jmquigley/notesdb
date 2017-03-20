/**
 *  Throwaway test helper functions that are shared between tests
 */

'use strict';

import * as assert from 'assert';
import * as fs from 'fs-extra';
import * as path from 'path';
import {Artifact, ArtifactType, IArtifactOpts} from '../../lib/artifact';
import {NotesDB} from '../../lib/notesdb';

const normalize = require('normalize-path');

const pkg = require('../../package.json');

export function validateDB(notesDB: NotesDB, binderName: string , root: string, valid: boolean): void {
	assert(notesDB && typeof notesDB !== 'undefined' && notesDB instanceof NotesDB);
	assert(notesDB.config.binderName === binderName);
	assert(notesDB.config.root === `${root}/`);
	assert(notesDB.config.dbdir === normalize(path.join(root, binderName)));
	assert(fs.existsSync(notesDB.configFile));
	assert(fs.existsSync(notesDB.config.metaFile));
	assert(valid);
	assert(fs.existsSync(path.join(root, 'notesdb.log')));
}

export function validateArtifact(artifact: Artifact, opts: IArtifactOpts): void {
	assert(artifact && typeof artifact !== 'undefined' && artifact instanceof Artifact);
	assert(artifact.section === (opts.section || ''));
	assert(artifact.notebook === (opts.notebook || ''));
	assert(artifact.filename === (opts.filename || ''));
	assert(artifact.type === (opts.type || ArtifactType.Unk));
}

export function debug(message: string): void {
	if (pkg.debug) {
		console.log(message);
	}
}
