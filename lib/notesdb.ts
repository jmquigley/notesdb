/**
 * This module contains all of the code to create and manipulate the application
 * database (text) structure.
 *
 */

'use strict';

import {EventEmitter} from 'events';
import * as fs from 'fs-extra';
import * as _ from 'lodash';
import * as log4js from 'log4js';
import * as objectAssign from 'object-assign';
import * as path from 'path';
import {Deque} from 'util.ds';
import {timestamp} from 'util.timestamp';
import {Artifact, ArtifactType, IArtifactSearch} from './artifact';

const walk = require('klaw-sync');
const home = require('expand-home-dir');
const util = require('./util');

const defRoot = home(path.join('~/', '.notesdb'));
const validNameChars = `-\\.+@_!$&0-9a-zA-Z `; // regex [] pattern

let defIgnoreList = ['.DS_Store', '.placeholder', 'Trash'];

export interface INotebook {
	[key: string]: Artifact;
}

export interface ISection {
	[key: string]: INotebook;
}

export interface ISchema {
	notes: {[key: string]: ISection};
	trash: {[key: string]: ISection};
}

export interface INotesDBOpts {
	binderName?: string;
	configRoot?: string;
	env?: Object;
	ignore?: string[];
	root?: string;
	bufSize?: number;
	saveInterval?: number;
	maxRecents?: number;
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
	trash: string;
	log4js: IAppenderList;
	root: string;
	saveInterval: number;
	bufSize: number;
	maxRecents: number;
}

export interface INamespace {
	notes: string;
	trash: string;
}

export const NS: INamespace = {
	notes: 'notes',
	trash: 'trash'
};

/** Creates an instance of the text database class */
export class NotesDB extends EventEmitter {

	private log: log4js.Logger;
	private _artifacts: any = new Map();
	private _config: IConfigDB;
	private _ignore: string[] = [];
	private _initialized: boolean = false;
	private _reID: RegExp = new RegExp(`^[${validNameChars}]+$`);
	private _fnSaveInterval: any;
	private _schema: ISchema = {
		notes: {},
		trash: {}
	};
	private _timedSave: boolean = false;
	private _recents: Deque = null;


	/**
	 * Creates the instance of the NotesDB class and loads or defines the
	 * initial configuration parameters.  If the schema already exists, then
	 * it will be loaded.
	 *
	 * @constructor
	 * @extends EventEmitter
	 * @param [opts] {object} optional parameters
	 *
	 * - `binderName {string} default='adb'`: The name of the binder when a
	 * new database is being created.  This is optional.  When loading an
	 * existing database the name of the binder is retrieved as part of the
	 * configuration.
	 * - `configRoot {string} default='~/.notesdb'`: The name of the
	 * configuration directory where the configuration and log files are
	 * located.
	 * - `env {object}`: a copy of the current runtime environment
	 * variables.  This allows for the environment to be changed before
	 * instantiating the class (for multiple instances and testing).
	 * - `ignore {Array}`: the list of file names that this database will
	 * ignore when parsing/processing artifacts.
	 * - `root {string} default='~/.notesdb'`: The path location to the
	 * database.  This is optional and only needed when creating a new
	 * database.
	 * - `saveInterval {number} default='5000'`: determines how often a
	 * save check is performed.  The schema is scanned and saved very N
	 * millis.
	 */
	constructor(opts?: INotesDBOpts) {
		super();

		let self = this;

		opts = objectAssign({
			binderName: 'adb',
			configRoot: '',
			env: process.env,
			ignore: defIgnoreList,
			root: defRoot,
			bufSize: (64 * 1024),
			saveInterval: 5000,
			maxRecents: 5
		}, opts);

		if (opts.configRoot === '') {
			opts.configRoot = opts.root;
		}

		let configFile = path.join(opts.configRoot, 'config.json');
		self._ignore = opts.ignore || defIgnoreList;

		if (fs.existsSync(configFile)) {
			// Opens an existing configuration file
			self._config = JSON.parse(fs.readFileSync(configFile).toString());

			// Apply optional overrides to an existing configuration
			self._config.bufSize = opts.bufSize;
			self._config.saveInterval = opts.saveInterval;
			self._config.maxRecents = opts.maxRecents;
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

			if (!fs.existsSync(self.config.trash)) {
				fs.mkdirsSync(self.config.trash);
			}
		}

		self._recents = new Deque(self.config.maxRecents);

		util.addConsole(self.config.log4js);
		log4js.configure(self.config.log4js);
		self.log = log4js.getLogger('notesdb');

		self.load('notes');
		self.load('trash');

		self._fnSaveInterval = setInterval(() => {
			self.saveBinder();
			self._timedSave = true;
		}, opts.saveInterval);

		// When a recent file is added, and one is "aged" off, then a call
		// the save to make sure it is written before removal.
		self.recents.on('remove', (artifact: Artifact) => {
			self.saveArtifact(artifact)
				.then((artifact: Artifact) => {
					self.log.debug(`Removal save of ${artifact.absolute}`);
				})
				.catch((err: string) => {
					self.log.error(`Removal save failed for ${artifact.absolute}: ${err}`);
				});
		});
	}

	/**
	 * Creates the requested artifact within the schema.  This will attempt
	 * to create each section, notebook, and document given.  If the item is
	 * empty, then it is ignored.
	 *
	 * The thenable return for this call is a reference to the artifact that
	 * was created.
	 *
	 * @param opts {IArtifactSearch} the artifact object to create (see above)
	 * @param area {string} the namespace area within the schema object to
	 * search.  There are two areas: notes & trash.
	 * @param self {NotesDB} a reference to the notes database instance
	 * @returns {Promise} a javascript promise object
	 */
	public add(opts: IArtifactSearch, area: string = NS.notes, self = this) {
		return new Promise((resolve, reject) => {
			let artifact: Artifact = null;
			if (opts instanceof Artifact) {
				artifact = opts;
			} else {
				artifact = Artifact.factory('all', opts);
			}
			artifact.root = self.config.dbdir;

			try {
				if (artifact.type === ArtifactType.SNA) {
					self.createSection(artifact, area);
					self.createNotebook(artifact, area);
					self.createArtifact(artifact, resolve, reject, area);
				} else if (artifact.type === ArtifactType.SN) {
					self.createSection(artifact, area);
					self.createNotebook(artifact, area);
					resolve(artifact);
				} else if (artifact.type === ArtifactType.S) {
					self.createSection(artifact, area);
					resolve(artifact);
				} else if (artifact.type === ArtifactType.Unk) {
					resolve(artifact);
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
	 * @param area {string} the namespace area within the schema object to
	 * search.  There are two areas: notes & trash.
	 * @param self {NotesDB} a reference to the notes database instance
	 * @returns {Promise} a javascript promise object
	 */
	public create(schema: string[] | string, area: string = NS.notes, self = this) {
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
					self.createSection(artifact, area);
				}, self);
				resolve(self);
			} catch (err) {
				reject(err.message);
			}
		});
	}

	/**
	 * Removes the current contents of the 'Trash' folder/section from the
	 * current DB.  It also resets the internal trash namespace to empty.  This
	 * will check that the directory requested is within the database location
	 * and has the 'Trash' directory.
	 * @param self {NotesDB} a reference to the notes database instance
	 * @returns {Promise} a javascript promise object.
	 */
	public emptyTrash(self = this) {
		return new Promise((resolve, reject) => {
			if (fs.existsSync(self.config.trash) &&
				self.config.trash.endsWith(`${path.sep}Trash`) &&
				self.config.trash.startsWith(self.config.dbdir)) {
				self.log.info('Emptying trash: ${self.config.trash}');

				fs.remove(self.config.trash, (err: Error) => {
					if (err) {
						reject(err.message);
					}

					self.schema.trash = {};
					fs.mkdirsSync(self.config.trash);
					resolve(self);
				});
			} else {
				reject(`Invalid trash directory, no empty: ${self.config.trash}`);
			}
		});
	}

	/**
	 * Performs a text search against all artifacts within the repository.
	 * This will return a list of all artifacts tha contain the requested
	 * string.  The string can be a regex.
	 *
	 * The thenable from this call is an Array of Artifacts that meet the
	 * search criteria.
	 *
	 * @param search {string} the regex string to used as the search criteria.
	 * @param self {NotesDB} a reference to the notes database instance
	 * @returns {Promise} a javascript promise object
	 */
	public find(search: string, self = this) {
		let regex = new RegExp(search);

		function searchArtifact(artifact: Artifact) {
			return new Promise((resolve, reject) => {
				let filename: string = path.join(self.config.dbdir, artifact.path());
				fs.readFile(filename, (err, data) => {
					if (err) {
						reject(err.message);
					}

					if (regex.test(data.toString())) {
						resolve(artifact);
					} else {
						resolve(null);
					}
				});
			});
		}

		return new Promise((resolve, reject) => {
			let promise: any[] = [];
			for (let artifact of self._artifacts.values()) {
				promise.push(searchArtifact(artifact));
			}

			Promise.all(promise)
				.then((artifacts: Artifact[]) => {
					resolve(artifacts.filter((n) => {
						return n != null
					}));
				})
				.catch((err: Error) => {
					reject(err);
				});
		});
	}

	/**
	 * Retrieves an artifact from the schema.  If it exists, then it is returned
	 * by the promise.  If it is not found, then an error will be thrown.  If
	 * the artifact has never been loaded before, then it is read from the
	 * filesystem when this request is made.
	 *
	 * When the request is a section or notebook a temporary artifact object
	 * is created and returned.
	 *
	 * @param opts {IArtifactSearch} the section/notebook/filename to search
	 * for within the schema.
	 * @param area {string} the namespace area within the schema object to
	 * search.  There are two areas: notes & trash.
	 * @param self {NotesDB} a reference to the notes database instance
	 * @returns {Promise} a javascript promise object.
	 */
	public get(opts: IArtifactSearch, area: string = NS.notes, self = this) {
		return new Promise((resolve, reject) => {
			let type: ArtifactType = Artifact.isType(opts);

			if (type === ArtifactType.SNA && self.hasArtifact(opts)) {
				let artifact = self._schema[area][opts.section][opts.notebook][opts.filename];
				let absolute = artifact.absolute();

				if (fs.existsSync(absolute) && !artifact.loaded) {
					let inp = fs.createReadStream(absolute);

					inp.on('close', () => {
						artifact.loaded = true;
						artifact.makeClean();
						self.recents.enqueue(artifact);
						resolve(artifact);
					});

					inp.on('error', (err: Error) => {
						reject(err.message);
					});

					inp.on('data', (chunk: string) => {
						artifact.buf += chunk;
					});
				} else {
					self.recents.enqueue(artifact);
					resolve(artifact);
				}
			} else if ((type === ArtifactType.SN && self.hasNotebook(opts, area)) ||
				(type === ArtifactType.S && self.hasSection(opts, area))) {
				let artifact = Artifact.factory('all', opts);
				artifact.root = self.config.dbdir;
				self.recents.enqueue(artifact);
				resolve(artifact);
			} else {
				reject(`Artifact doesn't exist: ${opts.section}|${opts.notebook}|${opts.filename}`);
			}
		});
	}

	/**
	 * Checks to see if a document is in the repository by name, notebook and
	 * section.
	 * @param search {IArtifactSearch} an object that represents the item to
	 * find in the schema.
	 * @param area {string} the namespace area within the schema object to
	 * search.  There are two areas: notes & trash.
	 * @param self {NotesDB} a reference to the notes database instance
	 * @returns {boolean} true if the artifact is found, otherwise false
	 */
	public hasArtifact(search: IArtifactSearch, area: string = NS.notes, self = this): boolean {
		if (self.hasSection(search, area) && self.hasNotebook(search, area)) {

			return Object.prototype.hasOwnProperty
				.call(self.schema[area][search.section][search.notebook], search.filename);
		}

		return false;
	}

	/**
	 * Checks the given section for the existence of a notebook by name.
	 * @param search {IArtifactSearch} an object that represents the item to
	 * find in the schema.
	 * @param area {string} the namespace area within the schema object to
	 * search.  There are two areas: notes & trash.
	 * @param self {NotesDB} a reference to the notes database instance
	 * @returns {boolean} true if the notebook is found, otherwise false
	 */
	public hasNotebook(search: IArtifactSearch, area: string = NS.notes, self = this): boolean {
		if (self.schema.hasOwnProperty(area)) {
			if (self.schema[area].hasOwnProperty(search.section)) {
				return Object.prototype.hasOwnProperty
					.call(self.schema[area][search.section], search.notebook);
			}
		}

		return false;
	}

	/**
	 * Checks the current schema for the existence of a section.
	 * @param search {IArtifactSearch} an object that represents the item to
	 * find in the schema.
	 * @param area {string} the namespace area within the schema object to
	 * search.  There are two areas: notes & trash.
	 * @param self {NotesDB} a reference to the notes database instance
	 * @return {boolean} true if the section is found, otherwise false.
	 */
	public hasSection(search: IArtifactSearch, area: string = NS.notes, self = this): boolean {
		if (self.schema.hasOwnProperty(area)) {
			return Object.prototype.hasOwnProperty.call(self.schema[area], search.section);
		}

		return false;
	}

	/**
	 * Enumerates the list of notebooks in a section from the schema.
	 * returns {Array} a list of the notebooks for a section
	 * @param sectionName {string} the name of the section where the notebooks
	 * are located.
	 * @param area {string} the namespace area within the schema object to
	 * search.  There are two areas: notes & trash.
	 * @param self {NotesDB} a reference to the notes database instance
	 */
	public notebooks(sectionName: string, area: string = NS.notes, self = this): string[] {
		let notebooks: string[] = [];

		if (!self.initialized) {
			throw new Error('Trying to retrieve notebooks from an unitialized database.');
		}

		if (self.hasSection({section: sectionName}, area)) {
			_.forOwn(self.schema[area][sectionName], (value: any, key: string) => {
				value.toString();
				notebooks.push(key);
			});
		} else {
			throw new Error(`Section '${sectionName}' not found in binder.`);
		}

		return (notebooks);
	}

	/**
	 * Scans the current repository directory to rebuild the schema.  This
	 * only needs to be done if a file/artifact is added to the directory
	 * structure after the instance has been loaded.
	 * @param area {string} the namespace area within the schema object to
	 * search.  There are two areas: notes & trash.
	 * @param self {NotesDB} a reference to the notes database instance
	 * @returns {Promise} a javascript promise object.
	 */
	public reload(area: string = NS.notes, self = this) {
		return new Promise((resolve, reject) => {
			self.initialized = false;
			try {
				self.load(area);
				resolve(self);
			} catch (err) {
				reject(err.message);
			}
		});
	}

	/**
	 * Moves an artifact from it's current directory to the "Trash" folder.  It
	 * is not removed until the emptyTrash() method is called.  The artifact
	 * is removed from the schema dictionary and stored in the trash dictionary.
	 *
	 * The thenable resolves to the path of the removed artifact.
	 *
	 * @param opts {IArtifactSearch} the section/notebook/filename to remove
	 * for within the schema.
	 * @param area {string} the namespace area within the schema object to
	 * search.  There are two areas: notes & trash.
	 * @param self {NotesDB} a reference to the notes database instance
	 * @returns {Promise} a javascript promise object.
	 */
	public remove(opts: IArtifactSearch, area: string = NS.notes, self = this) {
		return new Promise((resolve, reject) => {
			self.get(opts)
				.then((artifact: Artifact) => {
					let src: string = path.join(self.config.dbdir, artifact.path());
					let dst: string = path.join(self.config.dbdir, 'Trash', artifact.path());
					if (fs.existsSync(dst)) {
						dst = path.join(self.config.dbdir, 'Trash', self.makeUnique(artifact).path());
					}

					fs.move(src, dst, (err: Error) => {
						if (err) {
							reject(err.message);
						}

						switch (artifact.type) {
							case ArtifactType.SNA:
								self._artifacts.delete(artifact.path());
								delete self.schema[area][artifact.section][artifact.notebook][artifact.filename];
								break;

							case ArtifactType.SN:
								delete self.schema[area][artifact.section][artifact.notebook];
								break;

							case ArtifactType.S:
								delete self.schema[area][artifact.section];
								break;
						}

						self.reload('trash')
							.then(() => {
								resolve(dst);
							})
							.catch((err: string) => {
								reject(err);
							});
					});
				})
				.catch((err: string) => {
					reject(err);
				});
		});
	}

	/**
	 * Takes an item from the trash and puts it back into the schema.  If the
	 * item is already in the schema, then it appends a timestamp to the name
	 * of the item that is being restored.
	 *
	 * The thenable resolves to the path of the restored artifact.
	 *
	 * @param opts {IArtifactSearch} The section/notebook/filename to restore
	 * @param self {NotesDB} a reference to the notes database instance
	 * @returns {Promise} a javascript promise object.
	 */
	public restore(opts: IArtifactSearch, self = this) {
		return new Promise((resolve, reject) => {
			let artifact: Artifact = Artifact.factory('all', opts);
			artifact.root = self.config.dbdir;

			let src: string = path.join(self.config.dbdir, 'Trash', artifact.path());
			if (!fs.existsSync(src)) {
				reject(`This artifact doesn't exist in Trash and can't be restored: ${artifact.info()}`);
			}

			let dst: string = path.join(self.config.dbdir, artifact.path());
			if (fs.existsSync(dst)) {
				dst = path.join(self.config.dbdir, self.makeUnique(artifact).path());
			}

			fs.move(src, dst, (err: Error) => {
				if (err) {
					reject(err.message);
				}

				fs.removeSync(src);  // remove item in the trash
				self.reload()
					.then(() => {
						resolve(dst);
					})
					.catch((err: string) => {
						reject(err);
					});
			});
		});
	}

	/**
	 * User requested save function.  If given an artifact, then a single
	 * save is performed.  If no artifact is specifid, then the binder
	 * artifact list is scanned for dirty artifacts that need to be saved.
	 * @param self {NotesDB} a reference to the notes database instance
	 * @returns {Promise} a javascript promise object
	 */
	public save(self = this) {
		return new Promise((resolve, reject) => {
			try {
				self.saveBinder((err: Error) => {
					if (err) {
						reject(err.message);
					}

					resolve(self);
				});
			} catch (err) {
				reject(err.message);
			}
		});
	}

	/**
	 * Performs a save of a single artifact.
	 * @param artifact {Artifact} the artifact value to save
	 * @returns {Promise} a javascript promise object
	 */
	public saveArtifact(artifact: Artifact) {
		return new Promise((resolve, reject) => {
			if (artifact.isDirty()) {
				fs.writeFile(artifact.absolute(), artifact.buf, (err: Error) => {
					if (err) {
						reject(`Error writing artifact: ${err.message}`);
					}

					artifact.makeClean();
					resolve(artifact);
				});
			} else {
				resolve(artifact);
			}
		});
	}

	/**
	 * Enumerates the list of sections from the schema.
	 * @param area {string} the namespace area within the schema object to
	 * search.  There are two areas: notes & trash.
	 * @param self {NotesDB} a reference to the notes database instance
	 * @returns {Array} a future promise to return the list
	 */
	public sections(area: string = NS.notes, self = this): string[] {
		let sections: string[] = [];

		if (!self.initialized) {
			throw new Error('Trying to retrieve sections from an ' +
				'unitialized database.');
		}

		_.forOwn(self.schema[area], (value: any, key: string) => {
			value.toString();
			sections.push(key);
		});

		return (sections);
	}

	/**
	 * Called when the database is no longer needed.  This will cleanup
	 * operations and shutdown the intervals.
	 * @param self
	 * @returns {Promise} a javascript promise object
	 */
	public shutdown(self = this) {
		return new Promise((resolve, reject) => {
			try {
				self.saveBinder();
				clearInterval(self._fnSaveInterval);
				self.initialized = false;
				resolve('The database is shutdown.');
			} catch (err) {
				reject(err.message);
			}
		});
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

	get artifacts(): Map<string, Artifact> {
		return this._artifacts;
	}

	get config() {
		return this._config;
	}

	get configFile() {
		return this._config.configFile;
	}

	get ignore() {
		return this._ignore;
	}

	set ignore(val: string[]) {
		this._ignore = val;
	}

	get initialized() {
		return this._initialized;
	}

	set initialized(val: boolean) {
		this._initialized = val;
	}

	get recents() {
		return this._recents;
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
	 * @param area {string} the namespace area within the schema object to
	 * search.  There are two areas: notes & trash.
	 * @param self {NotesDB} a reference to the NotesDB instance
	 * @private
	 */
	private createArtifact(artifact: Artifact, resolve: Function, reject: Function, area: string = NS.notes, self = this) {
		if (artifact.hasSection() &&
			artifact.hasNotebook() &&
			artifact.hasFilename() &&
			!self.hasArtifact(artifact)) {
			if (self.isValidName(artifact.filename)) {
				let dst = path.join(self.config.dbdir, artifact.path());
				if (area === NS.trash) {
					dst = path.join(self.config.dbdir, 'Trash', artifact.path());
				}

				if (!fs.existsSync(dst)) {
					fs.writeFile(dst, artifact.buffer, (err: Error) => {
						if (err) {
							reject('Cannot create file: ${dst}');
						}
						artifact.loaded = true;
						self.log.info(`Added artifact: ${artifact.filename}`);
						resolve(artifact);
					});
				}

				self.schema[area][artifact.section][artifact.notebook][artifact.filename] = artifact;

				if (area !== NS.trash) {
					self._artifacts.set(artifact.path(), artifact);
				}
			} else {
				reject(`Invalid filename name '${artifact.filename}'.  Can only use '${validNameChars}'.`);
			}
		}

		resolve(artifact);
	}

	/**
	 * Creates a new artifact (file) within the schema.  This call is a
	 * synchronous write of the file.
	 * @param artifact {Artifact} a structure that holds the details for the file
	 * that will be created.
	 * @param area {string} the namespace area within the schema object to
	 * search.  There are two areas: notes & trash.
	 * @param self {NotesDB} a reference to the NotesDB instance
	 * @private
	 */
	private addArtifact(artifact: Artifact, area: string = NS.notes, self = this) {
		if (artifact.hasSection() &&
			artifact.hasNotebook() &&
			artifact.hasFilename() &&
			!self.hasArtifact(artifact, area)) {
			if (self.isValidName(artifact.filename)) {
				self.schema[area][artifact.section][artifact.notebook][artifact.filename] = artifact;

				if (area !== NS.trash) {
					self._artifacts.set(artifact.path(), artifact);
				}
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
		let configFile: string = path.join(opts.configRoot || './', 'config.json');

		return {
			binderName: opts.binderName || 'adb',
			configFile: configFile,
			configRoot: opts.configRoot,
			dbdir: path.join(opts.root || './', opts.binderName || 'adb'),
			trash: path.join(opts.root || './', opts.binderName || 'adb', 'Trash'),
			log4js: {
				appenders: [
					{
						category: 'notesdb',
						filename: path.join(path.dirname(configFile || './'), 'notesdb.log'),
						type: 'file'
					}
				]
			},
			root: opts.root || '',
			saveInterval: opts.saveInterval,
			bufSize: opts.bufSize,
			maxRecents: opts.maxRecents
		};
	}

	/**
	 * Creates a new notebook within a section.
	 * @param artifact {Artifact} the name of the notebook to create
	 * @param area {string} the namespace area within the schema object to
	 * search.  There are two areas: notes & trash.
	 * @param self {NotesDB} a reference to the NotesDB instance
	 * @returns {NotesDB} a reference to the changed DB instance
	 * @private
	 */
	private createNotebook(artifact: Artifact, area: string = NS.notes, self = this) {
		if (artifact.hasSection() && artifact.hasNotebook() && self.hasSection(artifact, area) && !self.hasNotebook(artifact, area)) {
			if (self.isValidName(artifact.notebook)) {
				let dst = path.join(self.config.dbdir, artifact.section, artifact.notebook);
				if (area === NS.trash) {
					dst = path.join(self.config.dbdir, 'Trash', artifact.section, artifact.notebook);
				}

				if (!fs.existsSync(dst)) {
					self.log.debug(`Creating notebook: ${artifact.notebook} in section ${artifact.section}`);
					fs.mkdirsSync(dst);
				}

				if (!self.hasNotebook(artifact, area) && fs.existsSync(dst) && fs.lstatSync(dst).isDirectory()) {
					self.schema[area][artifact.section][artifact.notebook] = {};
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
	 * @param artifact {Artifact} the name of the section to create.
	 * @param area {string} the namespace area within the schema object to
	 * search.  There are two areas: notes & trash.
	 * @param self {NotesDB} a reference to the NotesDB instance
	 * @returns {NotesDB} a reference to the changed DB instance
	 * @private
	 */
	private createSection(artifact: Artifact, area: string = NS.notes, self = this) {
		if (!self.hasSection(artifact, area)) {
			if (self.isValidName(artifact.section)) {
				let dst = path.join(self.config.dbdir, artifact.section);
				if (area === NS.trash) {
					dst = path.join(self.config.dbdir, 'Trash', artifact.section);
				}

				if (!fs.existsSync(dst)) {
					self.log.info(`Creating section: ${artifact.section}`);
					fs.mkdirsSync(dst);
				}

				if (!self.hasSection(artifact, area) && fs.existsSync(dst) && fs.lstatSync(dst).isDirectory()) {
					self.schema[area][artifact.section] = {};
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
	 * @param area {string} the namespace area within the schema object to
	 * search.  There are two areas: notes & trash.
	 * @param self {NotesDB} a reference to the NotesDB instance
	 * @private
	 */
	private load(area: string = NS.notes, self = this) {
		self.validate();
		self.loadBinder(area);
		self.saveBinder();

		self.log.debug(`Loaded database '${self.config.binderName}' for ${area}.`);
		self.initialized = true;
	}

	/**
	 * Loads an existing text DB from the file system.  It finds the database by
	 * reading the configuration stored in self.  If there is no configuration
	 * information when this is called, then it does nothing.
	 * @param area {string} the namespace area within the schema object to
	 * search.  There are two areas: notes & trash.
	 * @param self {NotesDB} a reference to the NotesDB instance
	 * @private
	 */
	private loadBinder(area: string = NS.notes, self = this) {
		let directory = '';
		if (area === NS.trash) {
			directory = 'Trash';
			self.ignore = ['.DS_Store', '.placeholder'];
		} else {
			self.ignore = defIgnoreList;
		}

		self.tree(directory).forEach((it: string) => {
			let artifact = Artifact.factory('treeitem', {
				treeitem: it,
				root: self.config.dbdir
			});
			self.createSection(artifact, area);
			self.createNotebook(artifact, area);
			self.addArtifact(artifact, area);
		});
	}

	/**
	 * Takes an artifact and appends a timestamp to the last part of its path
	 * @param artifact {Artifact} the artifact to change
	 * @returns {Artifact} the modified artifact with a timestamp attached to
	 * the last element of the path.
	 * @private
	 */
	private makeUnique(artifact: Artifact): Artifact {
		artifact = _.cloneDeep(artifact);

		let ts: string = `.${timestamp()}`;
		if (artifact.type === ArtifactType.SNA) {
			artifact.filename += ts;
		} else if (artifact.type === ArtifactType.SN) {
			artifact.notebook += ts;
		} else if (artifact.type === ArtifactType.S) {
			artifact.section += ts;
		}

		return artifact;
	}

	/**
	 * Saves the internal state of the binder
	 * @param cb {Function} a callback function that is executed when all
	 * artifact save promises have resolved.
	 * @param self {NotesDB} a reference to the NotesDB instance
	 * @private
	 */
	private saveBinder(cb: Function = null, self = this) {
		self.log.debug(`Saving configuration: ${self.config.configFile}`);
		let data = JSON.stringify(self.config, null, '\t');
		fs.writeFileSync(self.config.configFile, data);

		let promises: any = [];
		for (let artifact of self.artifacts.values()) {
			promises.push(self.saveArtifact(artifact));
		}

		Promise.all(promises)
			.then(() => {
				if (cb && typeof cb === 'function') {
					cb(null);
				}
			})
			.catch((err: string) => {
				if (cb && typeof cb === 'function') {
					cb(new Error(err));
				}
			});
	}

	/**
	 * Returns an array that represents a "treeview" of the current notes
	 * database.  These represent relative paths from the root of the database.
	 * @param directory {string} the directory where the tree will be retrieved
	 * It is a relative path from the root of the schema.
	 * @param self {NotesDB} a reference to the NotesDB instance
	 * @returns {Array} a list of nodes/directories in the database tree.
	 * @private
	 */
	private tree(directory: string = '', self = this) {
		directory = (directory === '') ? self.config.dbdir : path.join(self.config.dbdir, directory);
		let l: string[] = [];
		let files = walk(directory, {ignore: self.ignore});

		files.forEach((file: any) => {
			l.push(file.path.replace(`${directory}${path.sep}`, ''));
		}, self);

		return l;
	}

	/**
	 * Checks the binder configuration to ensure that it is valid
	 * @param self {NotesDB} a reference to the NotesDB instance
	 * @private
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
