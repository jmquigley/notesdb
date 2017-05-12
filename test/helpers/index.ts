/**
 *  Throwaway test helper functions that are shared between tests
 */

'use strict';

import {CallbackTestContext} from 'ava';
import * as fs from 'fs-extra';
import * as path from 'path';
import {Fixture} from 'util.fixture';
import {Artifact, ArtifactType, IArtifactOpts} from '../../lib/artifact';
import {Binder} from '../../lib/binder';

const normalize = require('normalize-path');

const pkg = require('../../package.json');

export function validateDB(t: any, notesDB: Binder, binderName: string , root: string, valid: boolean): void {
	t.truthy(notesDB);
	t.is(notesDB.config.binderName, binderName);
	t.is(notesDB.config.root, root);

	const p = normalize(path.join(root, binderName));
	t.is(notesDB.config.dbdir, p);
	t.true(fs.existsSync(notesDB.configFile));
	t.true(fs.existsSync(notesDB.config.metaFile));
	t.true(valid);
	t.true(fs.existsSync(path.join(root, 'notesdb.log')));
}

export function validateArtifact(t: any, artifact: Artifact, opts: IArtifactOpts): void {
	t.truthy(artifact);
	t.is(artifact.section, (opts.section || ''));
	t.is(artifact.notebook, (opts.notebook || ''));
	t.is(artifact.filename, (opts.filename || ''));
	t.is(artifact.type, (opts.type || ArtifactType.Unk));
}

export function debug(message: string): void {
	if (pkg.debug) {
		console.log(message);
	}
}

export function cleanup(msg: string, t: CallbackTestContext): void {
	if (msg) {
		console.log(`final cleanup: ${msg}`);
	}

	Fixture.cleanup((err: Error, directories: string[]) => {
		if (err) {
			return t.fail(`Failure cleaning up after test: ${err.message}`);
		}

		directories.forEach((directory: string) => {
			t.false(fs.existsSync(directory));
		});

		t.end();
	});
}
