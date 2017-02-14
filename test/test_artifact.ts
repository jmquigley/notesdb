'use strict';

import {test, TestContext} from 'ava';
import * as fs from 'fs-extra';
import * as path from 'path';
import {Fixture} from 'util.fixture';
import {Artifact} from '../lib/artifact';
import {validateArtifact} from './helpers';

test.after.always((t: TestContext) => {
	console.log('final cleanup: test_artifacts');
	let directories = Fixture.cleanup();
	directories.forEach((directory: string) => {
		t.false(fs.existsSync(directory));
	});
});

test('Testing artifact with empty creation', (t: TestContext) => {
	let fixture = new Fixture();
	let artifact = Artifact.factory('empty', {
		root: fixture.dir
	});

	validateArtifact(artifact, 'Default', 'Default', '', t);

	t.is(artifact.info(), 'Default|Default|');
	t.true(typeof artifact.toString() === 'string');
	t.true(artifact.buffer instanceof Buffer);
	t.is(artifact.root, fixture.dir);
	t.is(artifact.path(), 'Default/Default');
	t.is(artifact.created, '');
	t.is(artifact.updated, '');
	t.is(artifact.type, '');
	t.truthy(artifact.layout);
	t.false(artifact.loaded);
	artifact.loaded = true;
	t.true(artifact.loaded);
	t.truthy(artifact.tags);
	t.true(artifact.tags instanceof Array);
});

test('Testing artifact with factory all creation', (t: TestContext) => {
	let fixture = new Fixture();
	let artifact = Artifact.factory('all', {
		root: fixture.dir,
		filename: 'filename',
		notebook: 'notebook',
		section: 'section'
	});

	validateArtifact(artifact, 'section', 'notebook', 'filename', t);

	t.is(artifact.root, fixture.dir);
	t.is(artifact.path(), 'section/notebook/filename');
	t.true(artifact.hasSection());
	t.true(artifact.hasNotebook());
	t.true(artifact.hasFilename());
});

test('Testing artifact with factory treeitem creation', (t: TestContext) => {
	let fixture = new Fixture();
	let artifact = Artifact.factory('treeitem', {
		treeitem: `section${path.sep}notebook${path.sep}filename`,
		root: fixture.dir
	});

	validateArtifact(artifact, 'section', 'notebook', 'filename', t);

	t.is(artifact.root, fixture.dir);
});

test('Testing artifact with factory treeitem section only creation', (t: TestContext) => {
	let fixture = new Fixture();
	let artifact = Artifact.factory('treeitem', {
		treeitem: 'section',
		root: fixture.dir
	});

	validateArtifact(artifact, 'section', 'Default', '', t);

	t.is(artifact.root, fixture.dir);
});

test('Testing artifact with factory treeitem section & notebook only creation', (t: TestContext) => {
	let fixture = new Fixture();
	let artifact = Artifact.factory('treeitem', {
		treeitem: `section${path.sep}notebook${path.sep}`,
		root: fixture.dir
	});

	validateArtifact(artifact, 'section', 'notebook', '', t);
});

test('Testing artifact with factory treeitem too many items on creation', (t: TestContext) => {
	let fixture = new Fixture();
	let artifact = Artifact.factory('treeitem', {
		treeitem: `section${path.sep}notebook${path.sep}filename${path.sep}blah1${path.sep}blah2`,
		root: fixture.dir
	});

	validateArtifact(artifact, 'section', 'notebook', 'filename', t);
});

test('Test with an unknown mode sent to factory', (t: TestContext) => {
	let artifact = Artifact.factory('blahblahblah');

	validateArtifact(artifact, 'Default', 'Default', '', t);
});

test('Testing the dirty flag', (t: TestContext) => {
	let artifact = Artifact.factory('all', {
		filename: 'filename',
		notebook: 'notebook',
		section: 'section'
	});

	t.false(artifact.isDirty());
	artifact.makeDirty();
	t.true(artifact.isDirty());
	artifact.makeClean();
	t.false(artifact.isDirty());
});

test('Testing has functions', (t: TestContext) => {
	let artifact = new Artifact();

	t.true(artifact.hasSection());
	t.true(artifact.hasNotebook());
	t.false(artifact.hasFilename());
});
