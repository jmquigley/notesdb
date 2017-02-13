/**
 *  Throwaway test helper functions that are shared between tests
 */

'use strict';

const path = require('path');
const test = require('ava');
const fs = require('fs-extra');
const Artifact = require('../../index').Artifact;
const NotesDB = require('../../index').NotesDB;

function validateDB(notesDB, configFile, binderName, root, valid, fixture, t) {  // eslint-disable-line max-params
	t.true(notesDB && typeof notesDB !== 'undefined' && notesDB instanceof NotesDB);
	t.is(notesDB.config.configFile, configFile);
	t.is(notesDB.config.binderName, binderName);
	t.is(notesDB.config.root, root);
	t.is(notesDB.config.dbdir, path.join(root, binderName));
	t.true(valid);

	if (fixture) {
		t.true(fs.existsSync(path.join(fixture.dir, 'notesdb.log')));
	}
}

function validateArtifact(artifact, section, notebook, filename, t) { // eslint-disable-line max-params
	t.true(artifact && typeof artifact !== 'undefined' && artifact instanceof Artifact);
	t.is(artifact.section, section);
	t.is(artifact.notebook, notebook);
	t.is(artifact.filename, filename);
}

module.exports = {
	validateArtifact: validateArtifact,
	validateDB: validateDB
};
