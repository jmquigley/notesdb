/**
 *  Throwaway test helper functions that are shared between tests
 */

'use strict';

const path = require('path');
const fs = require('fs-extra');
const NotesDB = require('../../index').NotesDB;

function validateDB(notesDB, configFile, binderName, root, valid, fixture, t) {  // eslint-disable-line max-params
	t.true(notesDB && typeof notesDB !== 'undefined' && notesDB instanceof NotesDB);
	t.is(notesDB.config.configFile, configFile);
	t.is(notesDB.config.binderName, binderName);
	t.is(notesDB.config.root, root);
	t.true(valid);

	if (fixture) {
		t.true(fs.existsSync(path.join(fixture.dir, 'notesdb.log')));
	}
}

module.exports = {
	validateDB: validateDB
};
