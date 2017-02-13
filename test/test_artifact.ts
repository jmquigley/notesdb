'use strict';

const test = require('ava');
const path = require('path');
const Artifact = require('../index').Artifact;
const validateArtifact = require('./helpers').validateArtifact;
const fs = require('fs-extra');
const Fixture = require('util.fixture');

test.after.always(t => {
	console.log('final cleanup: test_db_create');
	let directories = Fixture.cleanup();
	directories.forEach((directory) => {
		t.false(fs.existsSync(directory));
	});
});

test('Testing artifact with factory all creation', t => {
	let artifact = Artifact.factory('all', {
		filename: 'filename',
		notebook: 'notebook',
		section: 'section',
	});

	validateArtifact(artifact, 'section', 'notebook', 'filename', t);
});

test('Testing artifact with factory treeitem creation', t => {
	let treeitem = `section${path.sep}notebook${path.sep}filename`;
	let artifact = Artifact.factory('treeitem', treeitem);

	validateArtifact(artifact, 'section', 'notebook', 'filename', t);
});

test('Testing artifact with factory treeitem section only creation', t => {
	let treeitem = `section`;
	let artifact = Artifact.factory('treeitem', treeitem);

	validateArtifact(artifact, 'section', 'Default', '', t);
});

test('Testing artifact with factory treeitem section & notebook only creation', t => {
	let treeitem = `section${path.sep}notebook${path.sep}`;
	let artifact = Artifact.factory('treeitem', treeitem);

	validateArtifact(artifact, 'section', 'notebook', '', t);
});

test('Testing artifact with factory treeitem too many items on creation', t => {
	let treeitem = `section${path.sep}notebook${path.sep}filename${path.sep}blah1${path.sep}blah2`;
	let artifact = Artifact.factory('treeitem', treeitem);

	validateArtifact(artifact, 'section', 'notebook', 'filename', t);
});

test('Test with an unknown mode sent to factory', t => {
	let artifact = Artifact.factory('blahblahblah');

	validateArtifact(artifact, 'Default', 'Default', '', t);
});

test('Testing the dirty flag', t => {
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

test('Testing has functions', t => {
	let artifact = new Artifact();

	t.true(artifact.hasSection());
	t.true(artifact.hasNotebook());
	t.false(artifact.hasFilename());
	t.false(artifact.isEmpty());
});
