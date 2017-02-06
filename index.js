/**
 * This module contains all of the code to create an manipulate the application
 * database (text) structure.  The text database is just a directory structure.
 * The "database" is refered to as a binder.  The binder contains sections.
 * Each of the sections contain notebooks.  Each notebook contains artifacts.
 *
 *	 {binder}/
 *		 {section}/
 *			 {notebook 1}/
 *				 - {artifact 1}
 *				 - {artifact 2}
 *			 {notebook 2}/
 *
 * The main component of is the artifact.  These are the text files.
 *
 * @module notesdb
 */

'use strict';

const path = require('path');
const fs = require('fs-extra');
const home = require('expand-home-dir');
const objectAssign = require('object-assign');
const log4js = require('log4js');
const util = require('./util');

let log = null;
let self = null;

let reID = new RegExp(/^\w+$/);


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
		self = this;

		opts = objectAssign({
			defaultConfigFile: home(path.join('~/', '.notesdb', 'config.json')),
			saveInterval: 1000
		}, opts);

		this._schema = {};

		const envConfigFile = (process.env.NOTESDB_HOME) ? process.env.NOTESDB_HOME : null;

		if (configFile !== '' && fs.existsSync(configFile)) {
			this._config = JSON.parse(fs.readFileSync(configFile));
		} else if (envConfigFile !== null && fs.existsSync(envConfigFile)) {
			this._config = JSON.parse(fs.readFileSync(envConfigFile));
		} else if (fs.existsSync(opts.defaultConfigFile)) {
			this._config = JSON.parse(fs.readFileSync(opts.defaultConfigFile));
		} else {
			if (process.env.NOTESDB_HOME) {
				configFile = envConfigFile;
			} else if (configFile === '') {
				configFile = opts.defaultConfigFile;
			}

			this._config = createInitialConfig(configFile);

			if (!fs.existsSync(this._config.configRoot)) {
				fs.mkdirsSync(this._config.configRoot);
			}
		}

		util.addConsole(this._config.log4js);

		log4js.configure(this._config.log4js);
		log = log4js.getLogger('notesdb');

		log.debug(`Initialized notesdb with: ${this._config.configFile}`);

		loadBinder();
		let saveInterval = Object.prototype.hasOwnProperty.call(this._config, 'saveInterval') ? this._config.saveInterval : opts.saveInterval;
		setInterval(saveBinder, saveInterval);
	}


	/**
	 * Converts the internal structures to a string and returns it.
	 * @return {string} a string that shows the configuration and schema for
	 * the database.
	 */
	toString() {
		let obj = {
			config: this._config,
			schema: this._schema
		};

		return JSON.stringify(obj, null, 2);
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
	 * @returns {Promise} a javascript promise object
	 */
	createBinder(binderName, directory, opts = null) {
		opts = objectAssign({
			schema: ['Default']
		}, opts);

		return new Promise(function(resolve, reject) {
			if (isValidName(binderName)) {
				log.info(`Creating binder ${binderName} in ${directory}`);

				self.config.root = path.join(directory, binderName);
				self.config.binderName = binderName;

				if (!fs.existsSync(self.config.root)) {
					fs.mkdirsSync(self.config.root);
				}

				opts.schema.forEach(function (it) {
					this.createSection(it);
				}, self);

				loadBinder();
				saveBinder();
				resolve();
			} else {
				reject(`Invalid binder name '${binderName}'.  Can only use 'a-Z, 0-9, _'`);
			}
		});
	}

	/**
	 * Creates a new notebook within a section.
	 * @param notebookName {string} the name of the notebook to create
	 * @param sectionName {string} the name of the section where the notebook
	 * will be created.
	 * @returns {Promise} a javascript promise object
	 */
	createNotebook(notebookName, sectionName) {
		return new Promise(function(resolve, reject) {
			if (this.hasSection(sectionName)) {
				let dst = path.join(this._config.root, sectionName, notebookName);

				if (fs.existsSync(dst)) {
					log.warn(`The notebook ${notebookName} already exists... skipping.`);
				} else {
					fs.mkdirs(dst);
					log.info(`Creating notebook: ${notebookName} in section ${sectionName}`);
					this._schema[sectionName][notebookName] = {};
				}

				resolve();
			} else {
				reject(`Invalid section ${sectionName} used when creating notebook ${notebookName}`);
			}
		});
	}


	/**
	 * Creates a new section (directory) within the database.  If the section
	 * already exists, then the call is ignored.
	 * @param sectionName {string} the name of the section to create.
	 * @returns {Promise} a javascript promise object
	 */
	createSection(sectionName) {
		return new Promise(function(resolve, reject) {
			if (isValidName(sectionName)) {
				let dst = path.join(self.config.root, sectionName);

				if (fs.existsSync(dst)) {
					log.warn(` ~> section ${sectionName} already exists, no creation needed`);
				} else {
					log.info(` ~> creating section: ${sectionName}`);
					fs.mkdirs(dst);
				}

				if (!self.hasSection(sectionName)) {
					self._schema[sectionName] = {};
				}

				resolve();
			} else {
				reject(`Invalid section name '${sectionName}'.  Can only use 'a-Z, 0-9, _'`);
			}
		});
	}


	/**
	 * Enumerates the list of sections from the schema.
	 * @returns {Array} a list of section names as strings.
	 */
	getSections() {
		let sections = [];

		if (!this.initialized()) {
			log.warn('Trying to retrieve sections from an unitialized database.');
			return sections;
		}

		for (let key in this._schema) {
			if (Object.prototype.hasOwnProperty.call(this._schema, key)) {
				sections.push(key);
			}
		}

		return sections;
	}


	/**
	 * Checks the current schema for the existence of a section.
	 * @param sectionName {string} the name of the section to search for in
	 * the schema.
	 * @return {boolean} true if the section is found, otherwise false.
	 */
	hasSection(sectionName) {
		return Object.prototype.hasOwnProperty.call(this._schema, sectionName);
	}


	/**
	 * Checks the current database to see if it is initialized.  It checks to see
	 * if there is a binder and a valid location of that binder.
	 * @returns {boolean} true if the TxtDB is properly initialized, otherwise false.
	 */
	initialized() {
		return (this._config.binderName !== '' && this._config.root !== '');
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
 * Loads an existing text DB from the file system.  It finds the database by
 * reading the configuration stored in self.  If there is no configuration
 * information when this is called, then it does nothing.
 */
function loadBinder() {
	if (self.config.root !== '' && self.config.binderName !== '') {
		if (!fs.existsSync(self.config.configFile)) {
			throw new Error(`Can't find notesdb configuration: ${self.config.configFile}`);
		}

		if (!fs.existsSync(self.config.root)) {
			throw new Error(`No notesdb located @ ${self.config.root}`);
		}

		log.info(`Loading binder: ${self.config.binderName} in ${self.config.root}`);

		util.getDirectories(self.config.root).forEach(function (section) {
			log.info(` ~> section: ${section}`);
			self.schema[section] = {};
		});
	}
}


/**
 * Performs a save of the current database.  This writes the config
 * file to disk.
 */
function saveBinder() {
	return new Promise(function(resolve, reject) {
		if (self.initialized()) {
			fs.writeFile(self.config.configFile, JSON.stringify(self.config, null, '\t'), err => {
				if (err) {
					reject(err);
				}

				resolve();
			});
		}
	});
}

/**
 *  The directories within the db must follow a simple name check.  It must
 *  pass the following regex: /^\w+$/
 *
 *  @param str {string} the name of the database, section, or notebook
 *  @returns {boolean} true if the name is ok, otherwise false
 */
function isValidName(str) {
	return reID.test(str);
}


// function readSection(section) {
// 	//txtdb[section] = {};
// }
//
// function deleteSection(section) {}
//
