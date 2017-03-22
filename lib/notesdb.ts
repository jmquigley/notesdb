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
import * as path from 'path';
import {Deque} from 'util.ds';
import {join, normalize} from 'util.join';
import {Artifact, artifactComparator, ArtifactType, IArtifactMeta, IArtifactSearch} from './artifact';

const walk = require('klaw-sync');
const util = require('./util');

const defRoot = join('~/', '.notesdb');
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
	metaFile: string;
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

export interface INotesMeta {
	[key: string]: IArtifactMeta;
}

/** Creates an instance of the text database class */
export class NotesDB extends EventEmitter {

	private log: log4js.Logger;

	private _artifacts: any = new Map();
	private _config: IConfigDB;
	private _fnSaveInterval: any;
	private _ignore: string[] = [];
	private _initialized: boolean = false;
	private _meta: INotesMeta = {};
	private _recents: Deque = null;
	private _reID: RegExp = new RegExp(`^[${validNameChars}]+$`);
	private _schema: ISchema = {
		notes: {},
		trash: {}
	};
	private _timedSave: boolean = false;

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

		opts = Object.assign({
			binderName: 'adb',
			configRoot: '',
			env: process.env,
			ignore: [],
			root: defRoot,
			bufSize: (64 * 1024),
			saveInterval: 5000,
			maxRecents: 5
		}, opts);

		if (opts.configRoot === '') {
			opts.configRoot = opts.root;
		}

		let configFile = join(opts.configRoot, 'config.json');
		self.ignore = _.union(opts.ignore, defIgnoreList);

		if (fs.existsSync(configFile)) {
			// Opens an existing configuration file
			self._config = JSON.parse(fs.readFileSync(configFile).toString());

			if (self.config.hasOwnProperty('metaFile') && fs.existsSync(self._config.metaFile)) {
				self._meta = JSON.parse(fs.readFileSync(self._config.metaFile).toString());
			}

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
			fs.writeFileSync(self.config.metaFile, JSON.stringify(self.meta, null, '\t'));

			if (!fs.existsSync(self.config.dbdir)) {
				fs.mkdirsSync(self.config.dbdir);
			}

			if (!fs.existsSync(self.config.trash)) {
				fs.mkdirsSync(self.config.trash);
			}
		}

		self._recents = new Deque(self.config.maxRecents, artifactComparator);

		util.addConsole(self.config.log4js);
		log4js.configure(self.config.log4js);
		self.log = log4js.getLogger('notesdb');

		self.load('notes');
		self.load('trash');

		self._fnSaveInterval = setInterval(() => {
			self.save()
				.then((adb: NotesDB) => {
					adb._timedSave = true;
				})
				.catch((err: string) => {
					self.log.error(`Timed save failure: ${err}`);
				});
		}, opts.saveInterval);

		// When a recent file is added, and one is "aged" off, then a call
		// the save to make sure it is written before removal.
		self.recents.on('remove', (artifact: Artifact) => {
			self.saveArtifact(artifact)
				.then(() => {
					self.log.debug(`Removal save of ${artifact.absolute()}`);
				})
				.catch((err: string) => {
					self.log.error(`Removal save failed for ${artifact.absolute()}: ${err}`);
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
				artifact = Artifact.factory('fields', opts);
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
				} else {
					reject('Trying to add invalid artifact to DB');
				}
			} catch (err) {
				reject(err.message);
			}
		});
	}

	/**
	 * Creates new sections within a binder.  It takes a list of section
	 * strings and creates a directory for each given string.
	 *
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
					let artifact = Artifact.factory('fields', {
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
	 *
	 * The thenable resolves to a reference to the NotesDB instance.
	 *
	 * @param self {NotesDB} a reference to the notes database instance
	 * @returns {Promise} a javascript promise object.
	 */
	public emptyTrash(self = this) {
		return new Promise((resolve, reject) => {
			if (fs.existsSync(self.config.trash) &&
				self.config.trash.endsWith(`/Trash`) &&
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
				let filename: string = join(self.config.dbdir, artifact.path());
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
						return n != null;
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
	 * filesystem when this request is made.  This will place the artifact into
	 * the recent documents queue.
	 *
	 * When the request is a section or notebook a temporary artifact object
	 * is created and returned.
	 *
	 * The thenable resolves to the artifact created by the get request.
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

						if (!self.recents.contains(artifact)) {
							self.recents.enqueue(artifact);
						}

						fs.stat(absolute, (err, stats) => {
							if (err) {
								reject(err.message);
							}

							self.loadMetadata(artifact, stats);
							resolve(artifact);
						});
					});

					inp.on('error', (err: Error) => {
						reject(err.message);
					});

					inp.on('data', (chunk: string) => {
						artifact.buf += chunk;
					});
				} else {
					if (!self.recents.contains(artifact)) {
						self.recents.enqueue(artifact);
					}
					resolve(artifact);
				}
			} else if ((type === ArtifactType.SN && self.hasNotebook(opts, area)) ||
				(type === ArtifactType.S && self.hasSection(opts, area))) {
				let artifact = Artifact.factory('fields', opts);
				artifact.root = self.config.dbdir;
				if (!self.recents.contains(artifact)) {
					self.recents.enqueue(artifact);
				}
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
	 * @returns {Array} a list of notebook names as strings
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
	 * Immediately removes an section/notebook/artifact from the system.
	 *
	 * The thenable resolves to a reference to the NotesDB instance.
	 *
	 * @param opts {IArtifactSearch} the section/notebook/filename to search
	 * for within the schema.
	 * @param area {string} the namespace area within the schema object to
	 * search.  There are two areas: notes & trash.
	 * @param self {NotesDB} a reference to the notes database instance
	 * @returns {Promise} a javascript promise object
	 */
	public remove(opts: IArtifactSearch, area: string = NS.notes, self = this) {
		return new Promise((resolve, reject) => {
			self.get(opts)
				.then((artifact: Artifact) => {
					switch (artifact.type) {
						case ArtifactType.SNA:
							self._artifacts.delete(artifact.path());
							self.recents.eject(artifact);
							delete self.schema[area][artifact.section][artifact.notebook][artifact.filename];
							break;

						case ArtifactType.SN:
							delete self.schema[area][artifact.section][artifact.notebook];
							break;

						case ArtifactType.S:
							delete self.schema[area][artifact.section];
							break;

						default:
							reject('Invalid artifact type given in remove');
							break;
					}

					fs.remove(artifact.absolute(), (err) => {
						if (err) {
							reject(err.message);
						}

						resolve(self);
					});
				})
				.catch((err: string) => {
					reject(err);
				});
		});
	}

	/**
	 * Renames an artifact from the source (src) to destination (dst).
	 *
	 * The thenable resolves to a reference to the renamed artifact.
	 *
	 * @param src {IArtifactSearch} the source artifact that will be changed
	 * @param dst {IArtifactSearch} the destination artifact that the source
	 * will be changed into.
	 * @param self {NotesDB} a reference to the notes database instance
	 * @returns {Promise} a javascript promise object.
	 */
	public rename(src: IArtifactSearch, dst: IArtifactSearch, self = this) {
		return new Promise((resolve, reject) => {
			let srcArtifact: Artifact = null;
			let dstArtifact: Artifact = null;

			if (Artifact.isDuplicateSearch(src, dst)) {
				reject(`No difference between artifacts in rename request`);
			}

			self.get(src)
				.then((artifact: Artifact) => {
					srcArtifact = artifact;
					if (srcArtifact.type !== Artifact.isType(dst)) {
						reject('SRC artifact type does not match DST');
					}
					return self.add(dst);
				})
				.then((artifact: Artifact) => {
					dstArtifact = artifact;
					dstArtifact.meta = _.cloneDeep(srcArtifact.meta);
					dstArtifact.buf = srcArtifact.buf;
					dstArtifact.makeDirty();
				})
				.then(() => {
					return self.remove(srcArtifact);
				})
				.then(() => {
					resolve(dstArtifact);
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
	 * The thenable resolves to the artifact that was retored.
	 *
	 * @param opts {IArtifactSearch} The section/notebook/filename to restore
	 * @param self {NotesDB} a reference to the notes database instance
	 * @returns {Promise} a javascript promise object.
	 */
	public restore(opts: IArtifactSearch, self = this) {
		return new Promise((resolve, reject) => {
			let dstArtifact: Artifact = Artifact.factory('fields', opts);
			dstArtifact.root = self.config.dbdir;
			let srcArtifact: Artifact = dstArtifact.clone();
			srcArtifact.root = join(self.config.dbdir, 'Trash');

			// Compute the garbage can file/directory location
			if (!fs.existsSync(srcArtifact.absolute())) {
				reject(`This artifact doesn't exist in Trash and can't be restored: ${srcArtifact.info()}`);
			}

			// Compute the restore location
			if (fs.existsSync(dstArtifact.absolute())) {
				dstArtifact.makeUnique();
			}

			fs.move(srcArtifact.absolute(), dstArtifact.absolute(), (err: Error) => {
				if (err) {
					reject(err.message);
				}

				fs.removeSync(srcArtifact.absolute());

				// This is an expensive reload process.  When it s single item it's
				// expensive to do this, but if it's a directory with a lot of files
				// restored, then it would be worth the overhead.
				self.reload()
					.then(() => {
						resolve(dstArtifact);
					})
					.catch((errmsg: string) => {
						reject(errmsg);
					});
			});
		});
	}

	/**
	 * User requested save function.  If given an artifact, then a single
	 * save is performed.  If no artifact is specifid, then the binder
	 * artifact list is scanned for dirty artifacts that need to be saved.
	 *
	 * The thenable resolves to a reference to the NotesDB instance.
	 *
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
	 * @returns {Array} a list of section names as strings
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
				self.saveBinder((err: string) => {
					if (err) {
						reject(err);
					}

					clearInterval(self._fnSaveInterval);
					self.initialized = false;
					resolve('The database is shutdown.');
				});
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

	/**
	 * Moves an artifact from it's current directory to the "Trash" folder.  It
	 * is not removed until the emptyTrash() method is called.  The artifact
	 * is removed from the schema dictionary and stored in the trash dictionary.
	 *
	 * The thenable resolves to the artifact that was moved to the trash.
	 *
	 * @param opts {IArtifactSearch} the section/notebook/filename to remove
	 * for within the schema.
	 * @param self {NotesDB} a reference to the notes database instance
	 * @returns {Promise} a javascript promise object.
	 */
	public trash(opts: IArtifactSearch, self = this) {
		return new Promise((resolve, reject) => {
			self.get(opts)
				.then((srcArtifact: Artifact) => {
					let dstArtifact: Artifact = srcArtifact.clone();
					dstArtifact.root = join(self.config.dbdir, 'Trash');
					if (fs.existsSync(dstArtifact.absolute())) {
						dstArtifact.makeUnique();
					}

					fs.move(srcArtifact.absolute(), dstArtifact.absolute(), (err: Error) => {
						if (err) {
							reject(err.message);
						}

						self.remove(srcArtifact)
							.then((adb: NotesDB) => {
								return adb.reload('trash');
							})
							.then(() => {
								resolve(dstArtifact);
							})
							.catch((errmsg: string) => {
								reject(errmsg);
							});
					});
				})
				.catch((err: string) => {
					reject(err);
				});
		});
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

	get meta(): INotesMeta {
		return this._meta;
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
				self.loadMetadata(artifact);
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
				let dst = join(self.config.dbdir, artifact.path());
				if (area === NS.trash) {
					dst = join(self.config.dbdir, 'Trash', artifact.path());
				}

				if (!fs.existsSync(dst)) {
					// Note that if you try to use an async write here for the file
					// it will lead to intermediate failures in loading the stats
					// with a "file not found" error.  It seems that even though
					// the writeFile callback is executed, and the file "should" be
					// created, one cannot reliably use the fs.stat within that callback
					// to get the file details.
					fs.writeFileSync(dst, artifact.buffer);
				}

				fs.stat(dst, (err, stats) => {
					if (err) {
						reject(err.message);
					}

					artifact.loaded = true;
					self.loadMetadata(artifact, stats);
					self.schema[area][artifact.section][artifact.notebook][artifact.filename] = artifact;

					if (area !== NS.trash) {
						self._artifacts.set(artifact.path(), artifact);
					}

					self.log.info(`Added artifact: ${artifact.filename}`);
					resolve(artifact);
				});
			} else {
				reject(`Invalid filename name '${artifact.filename}'.  Can only use '${validNameChars}'.`);
			}
		} else {
			resolve(artifact);
		}
	}

	/**
	 * Takes the name of the initial configuration file and builds the initial
	 * structure for that configuration.
	 * @param opts {INotesDBOpts} parameters used to instantiate this object.
	 * @returns {IConfigDB} a newly populated configuration object
	 * @private
	 */
	private createInitialConfig(opts: INotesDBOpts): IConfigDB {
		let configFile: string = join(opts.configRoot || './', 'config.json');
		let metaFile: string = join(opts.configRoot || './', 'meta.json');

		return {
			binderName: opts.binderName || 'adb',
			configFile: configFile,
			configRoot: opts.configRoot,
			dbdir: join(opts.root || './', opts.binderName || 'adb'),
			trash: join(opts.root || './', opts.binderName || 'adb', 'Trash'),
			metaFile: metaFile,
			log4js: {
				appenders: [
					{
						category: 'notesdb',
						filename: join(path.dirname(configFile || './'), 'notesdb.log'),
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
		if (artifact.hasSection() && artifact.hasNotebook() &&
			self.hasSection(artifact, area) &&
			!self.hasNotebook(artifact, area)) {
			if (self.isValidName(artifact.notebook)) {
				let dst = join(self.config.dbdir, artifact.section, artifact.notebook);
				if (area === NS.trash) {
					dst = join(self.config.dbdir, 'Trash', artifact.section, artifact.notebook);
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
				let dst = join(self.config.dbdir, artifact.section);
				if (area === NS.trash) {
					dst = join(self.config.dbdir, 'Trash', artifact.section);
				}

				if (!fs.existsSync(dst)) {
					self.log.info(`Creating section: ${artifact.section}`);
					fs.mkdirsSync(dst);
				}

				if (!self.hasSection(artifact, area) &&
					fs.existsSync(dst) &&
					fs.lstatSync(dst).isDirectory()) {
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
		let trashIndex = self.ignore.indexOf('Trash');

		if (area === NS.trash) {
			directory = 'Trash';
			if (trashIndex !== -1) {
				self.ignore.splice(trashIndex, 1);
			}
		} else {
			if (trashIndex === -1) {
				self.ignore.push('Trash');
			}
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
	 * Takes an artifact and tries to load its meta data from the the
	 * configuration.  It will assign metadata that it finds to the aritifact.
	 * If the artifact isn't found in the configuration, then the default
	 * metadata from the artifact is used (and ultimately saved).
	 * @param artifact {Artifact} a reference to the artifact that will be
	 * loaded.
	 * @param [stats] {fs.Stats} the statistics object associated with this
	 * artifact.
	 * @param self {NotesDB} a reference to the NotesDB instance
	 * @private
	 */
	private loadMetadata(artifact: Artifact, stats: fs.Stats = null, self = this): void {
		if (artifact instanceof Artifact) {
			if (artifact.path() in self.meta) {
				artifact.meta = self.meta[artifact.path()];
			} else {
				self.meta[artifact.path()] = artifact.meta;
			}

			if (stats == null && fs.existsSync(artifact.absolute())) {
				stats = fs.statSync(artifact.absolute());
			}

			if (stats != null) {
				artifact.accessed = stats.atime;
				artifact.created = stats.birthtime;
				artifact.updated = stats.ctime;
			}
		}
	}

	/**
	 * Saves the internal state of the binder.  This includes saving any changes
	 * in the configuration or meta data for artifacts.  It also looks for
	 * "dirty" artifacts and saves them where necessary.
	 * @param cb {Function} a callback function that is executed when all
	 * artifact save promises have resolved.
	 * @param self {NotesDB} a reference to the NotesDB instance
	 * @private
	 */
	private saveBinder(cb: Function = null, self = this) {
		let promises: any = [];

		promises.push(new Promise((resolve, reject) => {
			self.log.debug(`Saving configuration: ${self.config.configFile}`);
			let data = JSON.stringify(self.config, null, '\t');
			fs.writeFile(self.config.configFile, data, (err) => {
				if (err) {
					reject(err.message);
				}
				resolve('Saved configuration');
			});
		}));

		promises.push(new Promise((resolve, reject) => {
			self.log.debug(`Saving meta data: ${self.config.metaFile}`);
			let data = JSON.stringify(self.meta, null, '\t');
			fs.writeFile(self.config.metaFile, data, (err) => {
				if (err) {
					reject(err.message);
				}
				resolve('Saved metadata');
			});
		}));

		for (let artifact of self.artifacts.values()) {
			promises.push(self.saveArtifact(artifact));
		}

		Promise.all(promises)
			.then((rets: any) => {
				if (cb && typeof cb === 'function' && rets instanceof Array) {
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
		directory = (directory === '') ? self.config.dbdir : join(self.config.dbdir, directory);
		let l: string[] = [];
		let files = walk(directory, {ignore: self.ignore});

		files.forEach((file: any) => {
			l.push(normalize(file.path).replace(`${directory}/`, ''));
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
