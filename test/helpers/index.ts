/**
 *  Throwaway test helper functions that are shared between tests
 */

'use strict';

import {TestContext} from 'ava';
import * as fs from 'fs-extra';
import * as path from 'path';
import {Artifact} from '../../lib/artifact';
import {NotesDB} from '../../lib/notesdb';

export function validateDB(notesDB: NotesDB, binderName: string , root: string, valid: boolean, t: TestContext) {  // eslint-disable-line max-params
	t.true(notesDB && typeof notesDB !== 'undefined' && notesDB instanceof NotesDB);
	t.is(notesDB.config.binderName, binderName);
	t.is(notesDB.config.root, root);
	t.is(notesDB.config.dbdir, path.join(root, binderName));
	t.true(valid);
	t.true(fs.existsSync(path.join(root, 'notesdb.log')));
}

export function validateArtifact(artifact: Artifact, section: string, notebook: string, filename: string, t: TestContext) { // eslint-disable-line max-params
	t.true(artifact && typeof artifact !== 'undefined' && artifact instanceof Artifact);
	t.is(artifact.section, section);
	t.is(artifact.notebook, notebook);
	t.is(artifact.filename, filename);
}
