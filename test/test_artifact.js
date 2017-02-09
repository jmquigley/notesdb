'use strict';

import test from 'ava';

const fs = require('fs-extra');
const Fixture = require('util.fixture');
const Artifact = require('../artifact');


test.after.always(t => {
	console.log('final cleanup: test_artifact');
	let directories = Fixture.cleanup();
	directories.forEach(directory => {
		t.false(fs.existsSync(directory));
	});
});


test('Testing artifact simple creation', t => {
	let artifact = new Artifact('section', 'notebook', 'filename');

	t.true(artifact && typeof artifact !== 'undefined' && artifact instanceof Artifact);
	t.is(artifact.section, 'section');
	t.is(artifact.notebook, 'notebook');
	t.is(artifact.filename, 'filename');
});


test('Testing the dirty flag', t => {
	let artifact = new Artifact('section', 'notebook', 'filename');

	t.false(artifact.isDirty());
	artifact.makeDirty();
	t.true(artifact.isDirty());
	artifact.makeClean();
	t.false(artifact.isDirty());
});


test('Testing has functions', t => {
	let artifact = new Artifact();

	t.false(artifact.hasSection());
	t.false(artifact.hasFilename());
	t.false(artifact.hasNotebook());
	t.true(artifact.isEmpty());
});
