/**
 * This module contains all of the code to create an manipulate the application
 * database (text) structure.  The text database is just a directory structure.
 * The "database" is refered to as a binder.  The binder contains sections.
 * Each of the sections contain notebooks.  Each notebook contains artifacts.
 *
 *     {binder}/
 *         {section}/
 *             {notebook 1}/
 *				 - {artifact 1}
 *				 - {artifact 2}
 *				 - {artifact N}
 *			   {notebook 2}/
 *				 - {artifact 1}
 *				 - {artifact 2}
 *				 - {artifact N}
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
const _ = require('lodash');
const fs = require('fs-extra');
const home = require('expand-home-dir');
const objectAssign = require('object-assign');
const log4js = require('log4js');
const util = require('./util');
const Artifact = require('./artifact');


/** Creates an instance of the text database class */
class NotesDB {

	/**
	 * Creates the instance of the class and loads or defines the initial
	 * configuration parameters.
	 * @constructor
	 * @param configFile {string} optional configuration file that tells this
	 * instance where to find an existing database.
	 * @param [opts] {object} optional parameters
	 *
	 *     - defaultConfigFile: an override for the default location of the
	 *     database configuration.  It is in ~/.notesdb/config.json by default.
	 *     - saveInterval: determines how often a save check is performed.  It
	 *     is 1000 ms by default.
	 */
	constructor(configFile = '', opts = null) {
		let self = this;
		self.reID = new RegExp(/^[0-9a-zA-Z ]+$/);

		opts = objectAssign({
			defaultConfigFile: home(path.join('~/', '.notesdb', 'config.json')),
			saveInterval: 1000,
			env: process.env
		}, opts);

		self._schema = {};

		const envConfigFile = (opts.env.NOTESDB_HOME) ? opts.env.NOTESDB_HOME : null;

		if (configFile !== '' && fs.existsSync(configFile)) {
			// Opens an existing configuration file
			self._config = JSON.parse(fs.readFileSync(configFile));
		} else if (envConfigFile !== null && fs.existsSync(envConfigFile)) {
			// Opens an existing configuration file via NOTESDB_HOME
			self._config = JSON.parse(fs.readFileSync(envConfigFile));
		} else if (fs.existsSync(opts.defaultConfigFile)) {
			// Opens an existing configuration file based on default location
			self._config = JSON.parse(fs.readFileSync(opts.defaultConfigFile));
		} else {
			// No configuration exists, so create a new database with this call
			if (opts.env.NOTESDB_HOME) {
				configFile = envConfigFile;
			} else if (configFile === '') {
				configFile = opts.defaultConfigFile;
			}

			self._config = createInitialConfig(configFile);

			if (!fs.existsSync(self._config.configRoot)) {
				fs.mkdirsSync(self._config.configRoot);
			}
		}

		util.addConsole(self._config.log4js);

		log4js.configure(self._config.log4js);
		self.log = log4js.getLogger('notesdb');

		self.log.debug(`Initialized notesdb with: ${self._config.configFile}`);

		loadBinder(self);
		let saveInterval = Object.prototype.hasOwnProperty.call(self._config, 'saveInterval') ? self._config.saveInterval : opts.saveInterval;
		setInterval(self.save, saveInterval);
	}


	/**
	 * Creates the requested artifact within the database.  This will attempt
	 * to create each section, notebook, and document given.  If the item is
	 * empty, then it is ignored.
	 * @param artifact {Artifact} the artifact object to create (see above)
	 */
	add(artifact) {
		let self = this;
		if (artifact && typeof artifact !== 'undefined' && artifact instanceof Artifact) {
			return createSection(self, artifact.section)
				.then(function (self) {
					return createNotebook(self, artifact.notebook, artifact.section);
				})
				.then(function (self) {
					return createArtifact(self, artifact);
				})
				.catch(err => {
					return Promise.reject(err);
				});
		}

		return Promise.reject('Invalid artifact given for creation');
	}


	/**
	 * Creates a new database binder at the requested location.
	 * @param binderName {string} the name of the database
	 * @param directory {string} the root location for the binder
	 * @param [opts] {object} optional parameters
	 *
	 *     - schema: a list of directories (sections) under this binder location.
	 *     each of these directories will be created under this binder unless they
	 *     already exist.
	 *
	 * @param self {NotesDB} a reference to the notes database instance
	 * @returns {Promise} a javascript promise object
	 */
	create(binderName, directory, opts = null, self = this) {
		opts = objectAssign({
			schema: ['Default']
		}, opts);

		return new Promise(function(resolve, reject) {
			if (isValidName(self, binderName)) {
				self.log.info(`Creating binder ${binderName} in ${directory}`);

				self.config.root = path.join(directory, binderName);
				self.config.binderName = binderName;

				if (!fs.existsSync(self.config.root)) {
					fs.mkdirsSync(self.config.root);
				}

				let promises = [];
				opts.schema.forEach(function(it) {
					promises.push(createSection(self, it));
				}, self);

				Promise.all(promises)
					.then(function() {
						loadBinder(self);
						self.save();
						resolve(self);
					})
					.catch(err => {
						reject(err);
						return;
					});
			} else {
				reject(`Invalid binder name '${binderName}'.  Can only use 'a-Z, 0-9, _'`);
			}
		});
	}


	/**
	 * Checks the given section for the existence of a notebook by name.
	 * @param notebookName {string} the name of the notebook in the section
	 * @param sectionName {string} the name of the section in the schema
	 * @param self {NotesDB} a reference to the notes database instance
	 * @returns {boolean} true if the notebook is found, otherwise false
	 */
	hasNotebook(notebookName, sectionName, self = this) {
		return Object.prototype.hasOwnProperty.call(self.schema[sectionName], notebookName);
	}


	/**
	 * Checks the current schema for the existence of a section.
	 * @param sectionName {string} the name of the section to search for in
	 * the schema.
	 * @param self {NotesDB} a reference to the notes database instance
	 * @return {boolean} true if the section is found, otherwise false.
	 */
	hasSection(sectionName, self = this) {
		return Object.prototype.hasOwnProperty.call(self.schema, sectionName);
	}


	/**
	 * Enumerates the list of notebooks in a section from the schema.
	 * returns {Array} a list of the notebooks for a section
	 * @param sectionName {string} the name of the section where the notebooks
	 * are located.
	 * @param self {NotesDB} a reference to the notes database instance
	 */
	notebooks(sectionName, self = this) {
		return new Promise(function(resolve, reject) {
			let notebooks = [];

			if (!self.initialized()) {
				reject('Trying to retrieve notebooks from an unitialized database.');
				return;
			}

			if (self.hasSection(sectionName)) {
				_.forOwn(self.schema[sectionName], (value, key) => {
					notebooks.push(key);
				});
			} else {
				reject(`Section '${sectionName}' not found in binder.`);
				return;
			}

			resolve(notebooks);
		});
	}


	/**
	 * Wrapper used to save the current database binder.  It wraps a promise
	 * from the private saveBinder function.
	 * @param self {NotesDB} a reference to the notes database instance
	 */
	save(self = this) {
		saveBinder(self)
			.then(db => {
				db.log.debug('Timed save of the database');
			})
			.catch(err => {
				self.log.error(`Timed save of database failed: ${err}`);
			});
	}


	/**
	 * Enumerates the list of sections from the schema.
	 * @param self {NotesDB} a reference to the notes database instance
	 * @returns {Promise} a future promise to return the list
	 */
	sections(self = this) {
		return new Promise(function(resolve, reject) {
			let sections = [];

			if (!self.initialized()) {
				reject('Trying to retrieve sections from an unitialized database.');
				return;
			}

			_.forOwn(self.schema, (value, key) => {
				sections.push(key);
			});

			resolve(sections);
		});
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

		return JSON.stringify(obj, null, 2);
	}


	/**
	 * Checks the current database to see if it is initialized.  It checks to see
	 * if there is a binder and a valid location of that binder.
	 * @param self {NotesDB} a reference to the notes database instance
	 * @returns {boolean} true if the TxtDB is properly initialized, otherwise false.
	 */
	initialized(self = this) {
		return (self._config.binderName !== '' && self._config.root !== '');
	}


	get config() {
		return this._config;
	}

	get schema() {
		return this._schema;
	}
}


module.exports = NotesDB;


//
// Private module functions
//


/**
 * Takes an artifact object and creates
 * @param self
 * @param artifact
 * @returns {Promise}
 */
function createArtifact(self, artifact) {
	artifact.toString();
	return Promise.resolve(self);
}


/**
 * Takes the name of the initial configuration file and builds the initial
 * structure for that configuration.
 * @param configFile {string} the filename for the configuration file
 * @returns {object} a configuration object
 */
function createInitialConfig(configFile) {
	return {
		root: '',
		binderName: '',
		configFile: configFile,
		configRoot: path.dirname(configFile),
		log4js: {
			appenders: [
				{
					type: 'file',
					filename: path.join(path.dirname(configFile), 'notesdb.log'),
					category: 'notesdb'
				}
			]
		},
		saveInterval: 1000
	};
}


/**
 * Creates a new notebook within a section.
 * @param self {NotesDB} a reference to the notes database instance
 * @param notebookName {string} the name of the notebook to create
 * @param sectionName {string} the name of the section where the notebook
 * will be created.
 * @returns {Promise} a javascript promise object
 */
function createNotebook(self, notebookName, sectionName) {
	if (notebookName === '') {
		return Promise.resolve(self);
	}

	return new Promise(function(resolve, reject) {
		if (isValidName(self, notebookName)) {
			let dst = path.join(self.config.root, sectionName, notebookName);

			if (fs.existsSync(dst)) {
				self.log.warn(`The notebook ${notebookName} already exists... skipping.`);
			} else {
				fs.mkdirs(dst);
				self.log.info(`Creating notebook: ${notebookName} in section ${sectionName}`);
				self.schema[sectionName][notebookName] = {};
			}

			resolve(self);
		} else {
			reject(`Invalid notebook name '${notebookName}'`);
		}
	});
}


/**
 * Creates a new section (directory) within the database.  If the section
 * already exists, then the call is ignored.
 * @param sectionName {string} the name of the section to create.
 * @returns {Promise} a javascript promise object
 * @param self {NotesDB} a reference to the notes database instance
 */
function createSection(self, sectionName) {
	return new Promise(function(resolve, reject) {
		if (isValidName(self, sectionName)) {
			let dst = path.join(self.config.root, sectionName);

			if (fs.existsSync(dst)) {
				self.log.warn(` ~> section ${sectionName} already exists, no creation needed`);
			} else {
				self.log.info(` ~> creating section: ${sectionName}`);
				fs.mkdirs(dst);
			}

			if (!self.hasSection(sectionName)) {
				self.schema[sectionName] = {};
			}

			resolve(self);
		} else {
			reject(`Invalid section name '${sectionName}'.  Can only use 'a-Z, 0-9, _'`);
		}
	});
}


/**
 * Loads an existing text DB from the file system.  It finds the database by
 * reading the configuration stored in self.  If there is no configuration
 * information when this is called, then it does nothing.
 * @param self {NotesDB} a reference to the notes database instance
 */
function loadBinder(self) {
	if (self.config.root !== '' && self.config.binderName !== '') {
		if (!fs.existsSync(self.config.configFile)) {
			throw new Error(`Can't find notesdb configuration: ${self.config.configFile}`);
		}

		if (!fs.existsSync(self.config.root)) {
			throw new Error(`No notesdb located @ ${self.config.root}`);
		}

		self.log.info(`Loading binder: ${self.config.binderName} in ${self.config.root}`);

		util.getDirectories(self.config.root).forEach(function (section) {
			self.log.info(` ~> section: ${section}`);
			self.schema[section] = {};
		});
	}
}


/**
 * Performs a save of the current database.  This writes the config
 * file to disk.
 * @param self {NotesDB} a reference to the notes database instance
 */
function saveBinder(self) {
	return new Promise(function(resolve, reject) {
		if (self.initialized()) {
			fs.writeFile(self.config.configFile, JSON.stringify(self.config, null, '\t'), err => {
				if (err) {
					reject(err);
					return;
				}

				resolve(self);
			});
		}
	});
}

/**
 * The directories within the db must follow a simple name check.  It must
 * pass the following regex: /^\w+$/
 *
 * @param self {NotesDB} a reference to the notes database instance
 * @param str {string} the name of the database, section, or notebook
 * @returns {boolean} true if the name is ok, otherwise false
 */
function isValidName(self, str) {
	return self.reID.test(str);
}


// // function readSection(section) {
// // 	//txtdb[section] = {};
// // }
// //
// // function deleteSection(section) {}
// //
