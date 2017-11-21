/**
 *  Throwaway test helper functions that are shared between tests
 */

'use strict';

/* import {CallbackTestContext} from 'ava';*/
import * as fs from 'fs-extra';
import {Fixture} from 'util.fixture';
import {join} from 'util.join';
import {IRejectFn, IResolveFn} from 'util.promise';
import {waitPromise} from 'util.wait';
import {Artifact, ArtifactOpts, ArtifactType} from '../../lib/artifact';
import {Binder} from '../../lib/binder';
import {BinderManager} from '../../lib/bindermanager';

const normalize = require('normalize-path');
const pkg = require('../../package.json');

export function validateBinder(t: any, notesDB: Binder, binderName: string , root: string, valid: boolean): void {
	t.truthy(notesDB);
	t.is(notesDB.config.binderName, binderName);
	t.is(notesDB.config.root, root);

	const p = normalize(join(root, binderName));
	t.is(notesDB.config.dbdir, p);
	t.true(fs.existsSync(notesDB.configFile));
	t.true(fs.existsSync(notesDB.config.metaFile));
	t.true(valid);
	t.true(fs.existsSync(join(root, 'notesdb.log')));
}

export function validateArtifact(t: any, artifact: Artifact, opts: ArtifactOpts): void {
	t.truthy(artifact);
	t.is(artifact.section, (opts.section || ''));
	t.is(artifact.notebook, (opts.notebook || ''));
	t.is(artifact.filename, (opts.filename || ''));
	t.is(artifact.type, (opts.type || ArtifactType.Unk));
}

export function validateManager(t: any, manager: BinderManager, fixture: Fixture): void {
	t.truthy(manager);
	t.is(manager.bindersDirectory, join(fixture.dir, 'binders'));
	t.true(fs.existsSync(join(fixture.dir, 'binders', 'default')));
	t.true(fs.existsSync(join(fixture.dir, 'binders', 'default', 'config.json')));

	const adb: Binder = manager.get('default');
	t.truthy(adb);
	t.true(adb instanceof Binder);
}

export function debug(message: string): void {
	if (pkg.debug) {
		console.log(message);
	}
}

export async function cleanup(msg: string, t: any, delay: number = 5) {
	await waitPromise(delay);
	await cleanupPromise(msg);
	t.pass();
	return Promise.resolve();
}

function cleanupPromise(msg: string) {
	return new Promise((resolve: IResolveFn, reject: IRejectFn) => {
		if (msg) {
			console.log(`final cleanup: ${msg}`);
		}

		Fixture.cleanup((err: Error, directories: string[]) => {
			if (err) {
				reject(`Failure cleaning up after test: ${err.message}`);
			}

			directories.forEach((directory: string) => {
				if (fs.existsSync(directory)) {
					reject(`Failure to cleanup directory: ${directory}`);
				}
			});

			resolve();
		});
	});
}
