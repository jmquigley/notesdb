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

import {EventEmitter} from 'events';
import * as fs from 'fs-extra';
import * as _ from 'lodash';
import * as log4js from 'log4js';
import * as objectAssign from 'object-assign';
import * as path from 'path';
import {Artifact, ArtifactType} from './artifact';

const walk = require('klaw-sync');
const home = require('expand-home-dir');
const util = require('./util');

const validNameChars = `-\\.+@_!$&0-9a-zA-Z `; // regex [] pattern

export interface INotebook {
	[name: string]: Artifact;
}

export interface ISection {
	[name: string]: INotebook;
}

export interface ISchema {
	[name: string]: ISection;
}

export interface INotesDBOpts {
	binderName?: string;
	configFile?: string;
	env?: Object;
	ignore?: string[];
	root?: string;
	saveInterval?: number;
}

export interface IAppender {
	category?: string;
	filename?: string;
	type: string;
}

export interface IAppenderList {
	appenders: IAppender[];
}

export interface IConfigDB {
	binderName: string;
	configFile: string;
	configRoot: string;
	dbdir: string;
	log4js: IAppenderList;
	root: string;
	saveInterval: number;
}

/** Creates an instance of the text database class */
export class NotesDB extends EventEmitter {

	private log: log4js.Logger;
	private _config: IConfigDB;
	private _ignore: string[] = [];
	private _initialized: boolean = false;
	private _reID: RegExp = new RegExp(`^[${validNameChars}]+$`);
	private _fnSaveInterval: any;
	private _schema: ISchema = {};
	private _timedSave: boolean = false;

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
	constructor(opts: INotesDBOpts) {
		super();

		let self = this;
		const defIgnoreList = ['.DS_Store', '.placeholder'];

		opts = objectAssign({
			binderName: 'adb',
			configFile: home(path.join('~/', '.notesdb', 'config.json')),
			env: process.env,
			ignore: defIgnoreList,
			root: home(path.join('~/', '.notesdb')),
			saveInterval: 5000
		}, opts);

		self._ignore = opts.ignore || defIgnoreList;

		if (fs.existsSync(opts.configFile)) {
			// Opens an existing configuration file
			self._config = JSON.parse(fs.readFileSync(opts.configFile).toString());
		} else {
			// Creates a new database
			self._config = self.createInitialConfig(opts);

			if (!self.isValidName(self.config.binderName)) {
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

		self.load();
		self._fnSaveInterval = setInterval(() => {
			self.saveBinder();
			self._timedSave = true;
		}, opts.saveInterval);
	}

	/**
	 * Creates the requested artifact within the database.  This will attempt
	 * to create each section, notebook, and document given.  If the item is
	 * empty, then it is ignored.
	 * @param artifact {Artifact} the artifact object to create (see above)
	 * @param self {NotesDB} a reference to the notes database instance
	 */
	public add(artifact: Artifact, self = this) {
		return new Promise((resolve, reject) => {
			artifact.root = self.config.dbdir;

			try {
				if (artifact.type === ArtifactType.SNA) {
					self.createSection(artifact);
					self.createNotebook(artifact);
					self.createArtifact(artifact, resolve, reject);
				} else if (artifact.type === ArtifactType.SN) {
					self.createSection(artifact);
					self.createNotebook(artifact);
					resolve(self);
				} else if (artifact.type === ArtifactType.S) {
					self.createSection(artifact);
					resolve(self);
				} else {
					reject('Trying to add invalid artifact to DB');
				}
			} catch (err) {
				reject(err.message);
			}
		});
	}

	/**
	 * Creates new sections within a binder.
	 * @param schema {Array|string} a list of directories (sections) under this
	 * binder location.  Each of these directories will be created under this
	 * binder unless they already exist.
	 * @param self {NotesDB} a reference to the notes database instance
	 * @returns {Promise} a javascript promise object
	 */
	public create(schema: string[] | string, self = this) {
		return new Promise((resolve, reject) => {
			if (typeof schema === 'string') {
				schema = [schema];
			}

			if (schema.length < 1) {
				schema.push('Default');
			}

			if (schema.indexOf('Trash') <= -1) {
				schema.push('Trash');
			}

			try {
				schema.forEach((it: string) => {
					let artifact = Artifact.factory('all', {
						section: it,
						root: self.config.dbdir
					});
					self.createSection(artifact);
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
	public hasArtifact(artifact: Artifact, self = this): boolean {
		artifact.root = self.config.dbdir;
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
	public hasNotebook(notebookName: string, sectionName: string, self = this): boolean {
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
	public hasSection(sectionName: string, self = this): boolean {
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
	public notebooks(sectionName: string, self = this): string[] {
		let notebooks: string[] = [];

		if (!self.initialized) {
			throw new Error('Trying to retrieve notebooks from an unitialized database.');
		}

		if (self.hasSection(sectionName)) {
			_.forOwn(self.schema[sectionName], (value: any, key: string) => {
				value.toString();
				notebooks.push(key);
			});
		} else {
			throw new Error(`Section '${sectionName}' not found in binder.`);
		}

		return (notebooks);
	}

	/**
	 * User requested save function.
	 * @param self {NotesDB} a reference to the notes database instance
	 */
	public save(self = this) {
		return new Promise((resolve, reject) => {
			try {
				self.saveBinder();
				resolve(self);
			} catch (err) {
				reject(err.message);
			}
		})
	}

	/**
	 * Enumerates the list of sections from the schema.
	 * @param self {NotesDB} a reference to the notes database instance
	 * @returns {Array} a future promise to return the list
	 */
	public sections(self = this): string[] {
		let sections: string[] = [];

		if (!self.initialized) {
			throw new Error('Trying to retrieve sections from an unitialized database.');
		}

		_.forOwn(self.schema, (value: any, key: string) => {
			value.toString();
			sections.push(key);
		});

		return (sections);
	}

	/**
	 * Called when the database is no longer needed.  This will cleanup
	 * operations and shutdown the intervals.
	 * @param self
	 */
	public shutdown(self = this) {
		self.saveBinder();
		clearInterval(self._fnSaveInterval);
		self.initialized = false;
	}

	/**
	 * Converts the internal structures to a string and returns it.
	 * @return {string} a string that shows the configuration and schema for
	 * the database.
	 * @param self {NotesDB} a reference to the notes database instance
	 */
	public toString(self = this) {
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

	set initialized(val: boolean) {
		this._initialized = val;
	}

	get reID() {
		return this._reID;
	}

	get schema() {
		return this._schema;
	}

	get timedSave() {
		return this._timedSave;
	}

	/**
	 * Creates a new artifact (file) within the schema.  This call is an async
	 * write of the file.  It expects to be called from a promise with the
	 * proper resolve/reject callbacks.
	 * @param artifact {Artifact} a structure that holds the details for the file
	 * that will be created.
	 * @param resolve {Function} a promise resolve function that can be called
	 * if this function is successful.
	 * @param reject {Function} a promise reject function that can be called
	 * if this function fails.
	 * @param self {NotesDB} a reference to the NotesDB instance
	 * @private
	 */
	private createArtifact(artifact: Artifact, resolve: Function, reject: Function, self = this) {
		if (artifact.hasSection() && artifact.hasNotebook() && artifact.hasFilename() && !self.hasArtifact(artifact)) {
			if (self.isValidName(artifact.filename)) {
				let dst = path.join(self.config.dbdir, artifact.path());
				if (!fs.existsSync(dst)) {
					fs.writeFile(dst, artifact.buffer, (err: Error) => {
						if (err) {
							reject('Cannot create file: ${dst}');
						}
						artifact.loaded = true;
						self.log.info(`Added artifact: ${artifact.filename}`);
						resolve(self);
					});
				}

				self.schema[artifact.section][artifact.notebook][artifact.filename] = artifact;
			} else {
				reject(`Invalid filename name '${artifact.filename}'.  Can only use '${validNameChars}'.`);
			}
		} else {
			resolve(self);
		}
	}

	/**
	 * Creates a new artifact (file) within the schema.  This call is a
	 * synchronous write of the file.
	 * @param artifact {Artifact} a structure that holds the details for the file
	 * that will be created.
	 * @param self {NotesDB} a reference to the NotesDB instance
	 * @private
	 */
	private addArtifact(artifact: Artifact, self = this) {
		if (artifact.hasSection() && artifact.hasNotebook() && artifact.hasFilename() && !self.hasArtifact(artifact)) {
			if (self.isValidName(artifact.filename)) {
				self.schema[artifact.section][artifact.notebook][artifact.filename] = artifact;
			} else {
				throw new Error(`Invalid filename name '${artifact.filename}'.  Can only use '${validNameChars}'.`);
			}
		}

		return self;
	}

	/**
	 * Takes the name of the initial configuration file and builds the initial
	 * structure for that configuration.
	 * @param opts {INotesDBOpts} parameters used to instantiate this object.
	 * @returns {IConfigDB} a newly populated configuration object
	 * @private
	 */
	private createInitialConfig(opts: INotesDBOpts): IConfigDB {
		return {
			binderName: opts.binderName || '',
			configFile: opts.configFile || '',
			configRoot: path.dirname(opts.configFile || ''),
			dbdir: path.join(opts.root || '', opts.binderName || ''),
			log4js: {
				appenders: [
					{
						category: 'notesdb',
						filename: path.join(path.dirname(opts.configFile || ''), 'notesdb.log'),
						type: 'file'
					}
				]
			},
			root: opts.root || '',
			saveInterval: 5000
		};
	}

	/**
	 * Creates a new notebook within a section.
	 * @param self {NotesDB} a reference to the NotesDB instance
	 * @param artifact {Artifact} the name of the notebook to create
	 * @returns {NotesDB} a reference to the changed DB instance
	 * @private
	 */
	private createNotebook(artifact: Artifact, self = this) {

		if (artifact.hasSection() && artifact.hasNotebook() && !self.hasNotebook(artifact.notebook, artifact.section)) {
			if (self.isValidName(artifact.notebook)) {
				let dst = path.join(self.config.dbdir, artifact.section, artifact.notebook);

				if (!fs.existsSync(dst)) {
					self.log.debug(`Creating notebook: ${artifact.notebook} in section ${artifact.section}`);
					fs.mkdirs(dst);
				}

				if (!self.hasNotebook(artifact.notebook, artifact.section)) {
					self.schema[artifact.section][artifact.notebook] = {};
				}

				return (self);
			} else { // eslint-disable-line no-else-return
				throw new Error(`Invalid notebook name '${artifact.notebook}'.  Can only use '${validNameChars}'.`);
			}
		}

		return self;
	}

	/**
	 * Creates a new section (directory) within the database.  If the section
	 * already exists, then the call is ignored.
	 * @param self {NotesDB} a reference to the NotesDB instance
	 * @param artifact {Artifact} the name of the section to create.
	 * @returns {NotesDB} a reference to the changed DB instance
	 * @private
	 */
	private createSection(artifact: Artifact, self = this) {
		if (!self.hasSection(artifact.section)) {
			if (self.isValidName(artifact.section)) {
				let dst = path.join(self.config.dbdir, artifact.section);

				if (!fs.existsSync(dst)) {
					self.log.info(`Creating section: ${artifact.section}`);
					fs.mkdirs(dst);
				}

				if (!self.hasSection(artifact.section)) {
					self.schema[artifact.section] = {};
				}

				return self;
			} else { // eslint-disable-line no-else-return
				throw new Error(`Invalid section name '${artifact.section}'.  Can only use '${validNameChars}'.`);
			}
		}

		return self;
	}

	/**
	 * The directories within the db must follow a simple name check.  It must
	 * pass the following regex: /^\w+$/
	 * @param self {NotesDB} a reference to the NotesDB instance
	 * @param str {string} the name of the database, section, or notebook
	 * @returns {boolean} true if the name is ok, otherwise false
	 * @private
	 */
	private isValidName(str: string, self = this) {
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
	private load(self = this) {
		if (!self.initialized) {
			self.validate();
			self.loadBinder();
			self.saveBinder();

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
	private loadBinder(self = this) {
		self.tree().forEach((it: string) => {
			let artifact = Artifact.factory('treeitem', {
				treeitem: it,
				root: self.config.dbdir
			});
			self.createSection(artifact);
			self.createNotebook(artifact);
			self.addArtifact(artifact);
		});
	}

	/**
	 * Saves the internal state of the binder
	 * @private
	 */
	private saveBinder(self = this) {
		self.log.debug(`Saving configuration: ${self.config.configFile}`);
		let data = JSON.stringify(self.config, null, '\t');
		fs.writeFileSync(self.config.configFile, data);
	}

	/**
	 * Returns an array that represents a "treeview" of the current notes
	 * database.  These represent relative paths from the root of the database.
	 * @returns {Array} a list of nodes/directories in the database tree.
	 */
	private tree(self = this) {
		let l: string[] = [];
		let files = walk(self.config.dbdir, {ignore: self.ignore});

		files.forEach((file: any) => {
			l.push(file.path.replace(`${self.config.dbdir}${path.sep}`, ''));
		}, self);

		return l;
	}

	/**
	 * Checks the binder configuration to ensure that it is valid
	 */
	private validate(self = this) {
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
}
