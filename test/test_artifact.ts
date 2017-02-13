'use strict';

import {test, TestContext} from 'ava';
import * as fs from 'fs-extra';
import * as path from 'path';
import {Artifact} from '../lib/artifact';
import {validateArtifact} from './helpers';

const Fixture = require('util.fixture');

test.after.always((t: TestContext) => {
	console.log('final cleanup: test_artifacts');
	let directories = Fixture.cleanup();
	directories.forEach((directory: string) => {
		t.false(fs.existsSync(directory));
	});
});

test('Testing artifact with factory all creation', (t: TestContext) => {
	let artifact = Artifact.factory('all', {
		filename: 'filename',
		notebook: 'notebook',
		section: 'section',
	});

	validateArtifact(artifact, 'section', 'notebook', 'filename', t);
});

test('Testing artifact with factory treeitem creation', (t: TestContext) => {
	let treeitem = `section${path.sep}notebook${path.sep}filename`;
	let artifact = Artifact.factory('treeitem', treeitem);

	validateArtifact(artifact, 'section', 'notebook', 'filename', t);
});

test('Testing artifact with factory treeitem section only creation', (t: TestContext) => {
	let treeitem = `section`;
	let artifact = Artifact.factory('treeitem', treeitem);

	validateArtifact(artifact, 'section', 'Default', '', t);
});

test('Testing artifact with factory treeitem section & notebook only creation', (t: TestContext) => {
	let treeitem = `section${path.sep}notebook${path.sep}`;
	let artifact = Artifact.factory('treeitem', treeitem);

	validateArtifact(artifact, 'section', 'notebook', '', t);
});

test('Testing artifact with factory treeitem too many items on creation', (t: TestContext) => {
	let treeitem = `section${path.sep}notebook${path.sep}filename${path.sep}blah1${path.sep}blah2`;
	let artifact = Artifact.factory('treeitem', treeitem);

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
		section: 'section',
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
	t.false(artifact.isEmpty());
});
