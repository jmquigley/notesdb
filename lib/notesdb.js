/**
 * This module contains all of the code to create an manipulate the application
 * database (text) structure.  The text database is just a directory structure.
 * The "database" is refered to as a binder.  The binder contains sections.
 * Each of the sections contain notebooks.  Each notebook contains artifacts.
 *
 *     {binder}/
 *         {section}/
 *             {notebook 1}/
 *                 - {artifact 1}
 *                 - {artifact 2}
 *                 - {artifact N}
 *               {notebook 2}/
 *                 - {artifact 1}
 *                 - {artifact 2}
 *                 - {artifact N}
 *          {section N}/
 *              ...
 *
 * The main component is the artifact.  These are the text files.  The others
 * are basic file directory strutures.
 *
 * @module notesdb
 */

'use strict';

const path = require('path');
const EventEmitter = require('events');
const _ = require('lodash');
const fs = require('fs-extra');
const log4js = require('log4js');
const objectAssign = require('object-assign');
const walk = require('klaw-sync');
const home = require('expand-home-dir');
const Artifact = require('./artifact');
const util = require('./util');

const validNameChars = `-\\.+@_0-9a-zA-Z `; // regex [] pattern

/** Creates an instance of the text database class */
class NotesDB extends EventEmitter {

	/**
	 * Creates the instance of the class and loads or defines the initial
	 * configuration parameters.
	 * @constructor
	 * @extends EventEmitter
	 * @param [opts] {object} optional parameters
	 *
	 *     - defaultConfigFile: an override for the default location of the
	 *     database configuration.  It is in ~/.notesdb/config.json by default.
	 *     - saveInterval: determines how often a save check is performed.  It
	 *     is 1000 ms by default.
	 *     - env: a copy of the current runtime environment variables.  This
	 *     allows for the environment to be changed before instantiating the
	 *     class (for multiple instances).
	 *     - ignore: the list of file names that this database will ignore
	 *     when parsing/processing artifacts.
	 */
	constructor(opts) {
		super();

		let self = this;

		opts = objectAssign({
			binderName: 'adb',
			configFile: home(path.join('~/', '.notesdb', 'config.json')),
			env: process.env,
			ignore: ['.DS_Store', '.placeholder'],
			root: home(path.join('~/', '.notesdb')),
			saveInterval: 5000
		}, opts);

		self._schema = {};
		self._ignore = opts.ignore;
		self._initialized = false;
		self._reID = new RegExp(`^[${validNameChars}]+$`);

		if (fs.existsSync(opts.configFile)) {
			// Opens an existing configuration file
			self._config = JSON.parse(fs.readFileSync(opts.configFile));
		} else {
			// Creates a new database
			self._config = _createInitialConfig(opts.configFile, opts);

			if (!_isValidName(self, self.config.binderName)) {
				throw new Error(`Invalid binder name '${self.config.binderName}'.  Can only use '${validNameChars}'.`);
			}

			if (!fs.existsSync(self.config.configRoot)) {
				fs.mkdirsSync(self.config.configRoot);
			}
			fs.writeFileSync(self.config.configFile, JSON.stringify(self.config, null, '\t'));

			if (!fs.existsSync(self.config.dbdir)) {
				fs.mkdirsSync(self.config.dbdir);
			}
		}

		util.addConsole(self.config.log4js);
		log4js.configure(self.config.log4js);
		self.log = log4js.getLogger('notesdb');

		_load(self);
		let saveInterval = Object.prototype.hasOwnProperty
			.call(self.config, 'saveInterval') ? self.config.saveInterval : opts.saveInterval;
		setInterval(() => {
			_save(self);
		}, saveInterval);
	}

	/**
	 * Creates the requested artifact within the database.  This will attempt
	 * to create each section, notebook, and document given.  If the item is
	 * empty, then it is ignored.
	 * @param artifact {Artifact} the artifact object to create (see above)
	 * @param self {NotesDB} a reference to the notes database instance
	 */
	add(artifact, self = this) {
		return new Promise((resolve, reject) => {
			if (artifact instanceof Artifact) {
				_addArtifact(self, artifact);
				resolve(self);
			} else {
				reject('Not a valid Artifact object for add().');
			}
		});
	}

	/**
	 * Creates nes sections within a binder.
	 * @param schema {Array|string} a list of directories (sections) under this
	 * binder location.  Each of these directories will be created under this
	 * binder unless they already exist.
	 * @param self {NotesDB} a reference to the notes database instance
	 * @returns {Promise} a javascript promise object
	 */
	create(schema, self = this) {
		return new Promise((resolve, reject) => {
			if (typeof schema === 'string') {
				schema = [schema];
			} else if (schema instanceof Array) {
				if (schema.length < 1) {
					schema.push('Default');
				}
			} else {
				reject('Schema must be an array of section names.');
			}

			try {
				schema.forEach(it => {
					_createSection(self, it);
				}, self);
				resolve(self);
			} catch (err) {
				reject(err.message);
			}
		});
	}

	/**
	 * Checks to see if a document is in the repository by name, notebook and
	 * section.
	 * @param artifact {Artifact} the document artifact to find
	 * @param self {NotesDB} a reference to the notes database instance
	 * @returns {boolean} true if the artifact is found, otherwise false
	 */
	hasArtifact(artifact, self = this) {
		return Object.prototype.hasOwnProperty
			.call(self.schema[artifact.section][artifact.notebook], artifact.filename);
	}

	/**
	 * Checks the given section for the existence of a notebook by name.
	 * @param notebookName {string} the name of the notebook in the section
	 * @param sectionName {string} the name of the section in the schema
	 * @param self {NotesDB} a reference to the notes database instance
	 * @returns {boolean} true if the notebook is found, otherwise false
	 */
	hasNotebook(notebookName, sectionName, self = this) {
		return Object.prototype.hasOwnProperty
			.call(self.schema[sectionName], notebookName);
	}

	/**
	 * Checks the current schema for the existence of a section.
	 * @param sectionName {string} the name of the section to search for in
	 * the schema.
	 * @param self {NotesDB} a reference to the notes database instance
	 * @return {boolean} true if the section is found, otherwise false.
	 */
	hasSection(sectionName, self = this) {
		return Object.prototype.hasOwnProperty
			.call(self.schema, sectionName);
	}

	/**
	 * Enumerates the list of notebooks in a section from the schema.
	 * returns {Array} a list of the notebooks for a section
	 * @param sectionName {string} the name of the section where the notebooks
	 * are located.
	 * @param self {NotesDB} a reference to the notes database instance
	 */
	notebooks(sectionName, self = this) {
		let notebooks = [];

		if (!self.initialized) {
			throw new Error('Trying to retrieve notebooks from an unitialized database.');
		}

		if (self.hasSection(sectionName)) {
			_.forOwn(self.schema[sectionName], (value, key) => {
				value.toString();
				notebooks.push(key);
			});
		} else {
			throw new Error(`Section '${sectionName}' not found in binder.`);
		}

		return (notebooks);
	}

	/**
	 * Enumerates the list of sections from the schema.
	 * @param self {NotesDB} a reference to the notes database instance
	 * @returns {Array} a future promise to return the list
	 */
	sections(self = this) {
		let sections = [];

		if (!self.initialized) {
			throw new Error('Trying to retrieve sections from an unitialized database.');
		}

		_.forOwn(self.schema, (value, key) => {
			value.toString();
			sections.push(key);
		});

		return (sections);
	}

	/**
	 * Converts the internal structures to a string and returns it.
	 * @return {string} a string that shows the configuration and schema for
	 * the database.
	 * @param self {NotesDB} a reference to the notes database instance
	 */
	toString(self = this) {
		let obj = {
			config: self.config,
			schema: self.schema
		};

		return JSON.stringify(obj, null, '\t');
	}

	//
	// Properties
	//

	get config() {
		return this._config;
	}

	get ignore() {
		return this._ignore;
	}

	get initialized() {
		return this._initialized;
	}

	set initialized(val) {
		if (typeof val === 'boolean') {
			this._initialized = val;
		} else {
			this._initialized = false;
		}
	}

	get reID() {
		return this._reID;
	}

	get schema() {
		return this._schema;
	}

}

module.exports = NotesDB;

/**
 * Adds a single artifact item to the schema
 * @param self {NotesDB} a reference to the NotesDB instance
 * @param artifact {Artifact} the object to add to the schema.
 * @private
 */
function _addArtifact(self, artifact) {
	if (!self.hasSection(artifact.section)) {
		_createSection(self, artifact.section);
	}

	if (artifact.hasSection() && artifact.hasNotebook() && !self.hasNotebook(artifact.notebook, artifact.section)) {
		_createNotebook(self, artifact.notebook, artifact.section);
	}

	if (artifact.hasSection() && artifact.hasNotebook() && artifact.hasFilename() && !self.hasArtifact(artifact)) {
		_createArtifact(self, artifact);
	}
}

/**
 * Creates a new artifact (file) within the schema.
 * @param self {NotesDB} a reference to the NotesDB instance
 * @param artifact {Artifact} a structure that holds the details for the file
 * that will be created.
 * @private
 */
function _createArtifact(self, artifact) {
	if (_isValidName(self, artifact.filename)) {
		let dst = path.join(self.config.dbdir, artifact.path());
		if (!fs.existsSync(dst)) {
			self.log.debug(`Writing artifact: ${dst}`);

			let out = fs.createWriteStream(dst);
			let inp = fs.createReadStream(artifact.buffer);

			inp.pipe(out);
			out.on('close', () => {
				artifact.loaded = true;
			});
			self.log.debug(`Added artifact: ${artifact.filename}`);
		}

		self.schema[artifact.section][artifact.notebook][artifact.filename] = artifact;
	} else {
		throw new Error(`Invalid filename name '${artifact.filename}'.  Can only use '${validNameChars}'.`);
	}
}

/**
 * Takes the name of the initial configuration file and builds the initial
 * structure for that configuration.
 * @param configFile {string} the filename for the configuration file
 * @param [opts] {Object} parameters used to instantiate this object.
 * @returns {object} a newly populated configuration object
 * @private
 */
function _createInitialConfig(configFile, opts) {
	return {
		binderName: opts.binderName,
		configFile: configFile,
		configRoot: path.dirname(configFile),
		dbdir: path.join(opts.root, opts.binderName),
		log4js: {
			appenders: [
				{
					category: 'notesdb',
					filename: path.join(path.dirname(configFile), 'notesdb.log'),
					type: 'file'
				}
			]
		},
		root: opts.root,
		saveInterval: 5000
	};
}

/**
 * Creates a new notebook within a section.
 * @param self {NotesDB} a reference to the NotesDB instance
 * @param notebookName {string} the name of the notebook to create
 * @param sectionName {string} the name of the section where the notebook
 * will be created.
 * @returns {NotesDB} a reference to the changed DB instance
 * @private
 */
function _createNotebook(self, notebookName, sectionName) {
	if (_isValidName(self, notebookName)) {
		let dst = path.join(self.config.dbdir, sectionName, notebookName);

		if (!fs.existsSync(dst)) {
			self.log.debug(`Creating notebook: ${notebookName} in section ${sectionName}`);
			fs.mkdirs(dst);
		}

		if (!self.hasNotebook(notebookName, sectionName)) {
			self.schema[sectionName][notebookName] = {};
		}

		return (self);
	} else { // eslint-disable-line no-else-return
		throw new Error(`Invalid notebook name '${notebookName}'.  Can only use '${validNameChars}'.`);
	}
}

/**
 * Creates a new section (directory) within the database.  If the section
 * already exists, then the call is ignored.
 * @param self {NotesDB} a reference to the NotesDB instance
 * @param sectionName {string} the name of the section to create.
 * @returns {NotesDB} a reference to the changed DB instance
 * @private
 */
function _createSection(self, sectionName) {
	if (_isValidName(self, sectionName)) {
		let dst = path.join(self.config.dbdir, sectionName);

		if (!fs.existsSync(dst)) {
			self.log.info(`Creating section: ${sectionName}`);
			fs.mkdirs(dst);
		}

		if (!self.hasSection(sectionName)) {
			self.schema[sectionName] = {};
		}

		return self;
	} else { // eslint-disable-line no-else-return
		throw new Error(`Invalid section name '${sectionName}'.  Can only use '${validNameChars}'.`);
	}
}

/**
 * The directories within the db must follow a simple name check.  It must
 * pass the following regex: /^\w+$/
 * @param self {NotesDB} a reference to the NotesDB instance
 * @param str {string} the name of the database, section, or notebook
 * @returns {boolean} true if the name is ok, otherwise false
 * @private
 */
function _isValidName(self, str) {
	return self.reID.test(str);
}

/**
 * This is called after the database instance is instantiated.  This is an
 * async call that precedes all other calls.  This ensures that it is
 * asynchronously loaded before it is used.  Once initialized, it is not
 * reloaded.
 * @param self {NotesDB} a reference to the NotesDB instance
 * @private
 */
function _load(self) {
	if (self.initialized) {
		_save(self);
	} else {
		_validate(self);
		_loadBinder(self);
		_save(self);

		self.log.info(`Loaded database '${self.config.binderName}'.`);
		self.initialized = true;
	}
}

/**
 * Loads an existing text DB from the file system.  It finds the database by
 * reading the configuration stored in self.  If there is no configuration
 * information when this is called, then it does nothing.
 * @param self {NotesDB} a reference to the NotesDB instance
 * @private
 */
function _loadBinder(self) {
	_tree(self).forEach(it => {
		let artifact = Artifact.factory('treeitem', it);
		_addArtifact(self, artifact);
	});
}

/**
 * Saves the internal state of the binder
 * @private
 */
function _save(self) {
	self.log.debug(`Saving configuration: ${self.config.configFile}`);
	let data = JSON.stringify(self.config, null, '\t');
	fs.writeFile(self.config.configFile, data, err => {
		if (err) {
			throw new Error(`Can't write configuration: ${self.config.configFile}.`);
		}
	});
}

/**
 * Returns an array that represents a "treeview" of the current notes
 * database.  These represent relative paths from the root of the database.
 * @returns {Array} a list of nodes/directories in the database tree.
 */
function _tree(self) {
	let l = [];
	let files = walk(self.config.dbdir, {ignore: self.ignore});

	files.forEach(file => {
		l.push(file.path.replace(`${self.config.dbdir}${path.sep}`, ''));
	}, self);

	return l;
}

/**
 * Checks the binder configuration to ensure that it is valid
 */
function _validate(self) {
	if (!fs.existsSync(self.config.configFile)) {
		throw new Error(`Can't find notesdb configuration: ${self.config.configFile}.`);
	}

	if (self.config.dbdir === '' || typeof self.config.dbdir === 'undefined') {
		throw new Error('The database directory is missing from configuration.');
	}

	if (!fs.existsSync(self.config.dbdir)) {
		throw new Error(`No notesdb located @ ${self.config.dbdir}.`);
	}
}

// // // function readSection(section) {
// // // 	//txtdb[section] = {};
// // // }
// // //
// // // function deleteSection(section) {}
// // //
