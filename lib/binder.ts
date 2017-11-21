/**
 * This module contains all of the code to create and manipulate the application
 * database (text) structure.
 *
 */

'use strict';

import autobind from 'autobind-decorator';
import {EventEmitter} from 'events';
import * as fs from 'fs-extra';
import * as _ from 'lodash';
import * as path from 'path';
import {Deque} from 'util.ds';
import {join, normalize} from 'util.join';
import logger, {Logger} from 'util.log';
import {PromiseFn} from 'util.promise';
import {INilCallback, nil} from 'util.toolbox';
import {
	Artifact,
	artifactComparator,
	ArtifactMeta,
	ArtifactSearch,
	ArtifactType
} from './artifact';

const walk = require('klaw-sync');

const defRoot = join('~/', '.notesdb');
const validNameChars = `-\\.+@_!$&0-9a-zA-Z `; // regex [] pattern
const defIgnoreList: string[] = ['.DS_Store', '.placeholder', 'Trash'];
const pkg = require('../package.json');

export interface Notebook {
	[key: string]: Artifact;
}

export interface Section {
	[key: string]: Notebook;
}

export interface Schema {
	notes: {[key: string]: Section};
	trash: {[key: string]: Section};
}

export interface BinderOpts {
	binderName?: string;
	configRoot?: string;
	env?: object;
	ignore?: string[];
	root?: string;
	bufSize?: number;
	saveInterval?: number;
	maxRecents?: number;
}

export interface Appender {
	category?: string;
	filename?: string;
	type: string;
}

export interface ConfigDB {
	binderName: string;
	configFile: string;
	configRoot: string;
	dbdir: string;
	trash: string;
	metaFile: string;
	root: string;
	logdir: string;
	saveInterval: number;
	bufSize: number;
	maxRecents: number;
}

export interface Namespace {
	notes: string;
	trash: string;
}

export const NS: Namespace = {
	notes: 'notes',
	trash: 'trash'
};

export interface NotesMeta {
	[key: string]: ArtifactMeta;
}

/** Creates an instance of the text binder class */
export class Binder extends EventEmitter {

	private _artifacts: any = new Map();
	private _config: ConfigDB = {
		binderName: '',
		configFile: '',
		configRoot: '',
		dbdir: '',
		trash: '',
		metaFile: '',
		root: '',
		logdir: '',
		saveInterval: 5000,
		bufSize: 65535,
		maxRecents: 5
	};
	private _fnSaveInterval: any;
	private _ignore: string[] = [];
	private _initialized: boolean = false;
	private _log: Logger = null;
	private _meta: NotesMeta = {};
	private _recents: Deque<Artifact> = null;
	private _reID: RegExp = new RegExp(`^[${validNameChars}]+$`);
	private _schema: Schema = {
		notes: {},
		trash: {}
	};
	private _timedSave: boolean = false;

	/**
	 * Creates the instance of the Binder class and loads or defines the
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
	constructor(opts?: BinderOpts) {
		super();

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

		const configFile = join(opts.configRoot, 'config.json');
		this.ignore = _.union(opts.ignore, defIgnoreList);

		if (fs.existsSync(configFile)) {
			// Opens an existing configuration file
			this._config = Object.assign(
				this._config,
				JSON.parse(fs.readFileSync(configFile).toString()));

			if (this.config.hasOwnProperty('metaFile') && fs.existsSync(this._config.metaFile)) {
				this._meta = JSON.parse(fs.readFileSync(this._config.metaFile).toString());
			}

			// Apply optional overrides to an existing configuration
			this._config.bufSize = opts.bufSize;
			this._config.saveInterval = opts.saveInterval;
			this._config.maxRecents = opts.maxRecents;
		} else {
			// Creates a new database
			this._config = Object.assign(
				this._config,
				this.createInitialConfig(opts));

			if (!this.isValidName(this.config.binderName)) {
				throw new Error(`Invalid binder name '${this.config.binderName}'.  Can only use '${validNameChars}'.`);
			}

			if (!fs.existsSync(this.config.configRoot)) {
				fs.mkdirsSync(this.config.configRoot);
			}
			fs.writeFileSync(this.config.configFile, JSON.stringify(this.config, null, '\t'));
			fs.writeFileSync(this.config.metaFile, JSON.stringify(this.meta, null, '\t'));

			if (!fs.existsSync(this.config.dbdir)) {
				fs.mkdirsSync(this.config.dbdir);
			}

			if (!fs.existsSync(this.config.trash)) {
				fs.mkdirsSync(this.config.trash);
			}
		}

		this._recents = new Deque<Artifact>(this.config.maxRecents, null, artifactComparator);

		this._log = logger.instance({
			debug: pkg.debug,
			toConsole: false,
			directory: this.config.logdir,
			eventFile: null,
			messageFile: 'notesdb.log',
			namespace: 'notesdb_binder'
		});

		this.load('notes');
		this.load('trash');

		if (opts.saveInterval > 0) {
			this._fnSaveInterval = setInterval(() => {
				this.save()
					.then((adb: Binder) => {
						adb._timedSave = true;
					})
					.catch((err: string) => {
						this.log.error(`Timed save failure: ${err}`);
					});
			}, opts.saveInterval);
		} else {
			this._fnSaveInterval = null;
		}

		// When a recent file is added, and one is "aged" off, then a call
		// the save to make sure it is written before removal.
		this.recents.on('remove', (artifact: Artifact) => {
			this.saveArtifact(artifact)
				.then(() => {
					this.log.info(`Removal save of ${artifact.absolute()}`);
				})
				.catch((err: string) => {
					this.log.error(`Removal save failed for ${artifact.absolute()}: ${err}`);
				});
		});

		this.emit('loaded', this);
	}

	/**
	 * Creates the requested artifact within the schema.  This will attempt
	 * to create each section, notebook, and document given.  If the item is
	 * empty, then it is ignored.
	 *
	 * The thenable return for this call is a reference to the artifact that
	 * was created.
	 *
	 * @param opts {ArtifactSearch} the artifact object to create (see above)
	 * @param area {string} the namespace area within the schema object to
	 * search.  There are two areas: notes & trash.
	 * @returns {Promise} a javascript promise object
	 */
	@autobind
	public add(opts: ArtifactSearch, area: string = NS.notes): any {
		return new Promise((resolve: PromiseFn<Artifact>, reject: PromiseFn<string>) => {
			let artifact: Artifact = null;
			if (opts instanceof Artifact) {
				artifact = opts;
			} else {
				artifact = Artifact.factory('fields', opts);
			}
			artifact.root = this.config.dbdir;

			try {
				if (artifact.type === ArtifactType.SNA) {
					this.createSection(artifact, area);
					this.createNotebook(artifact, area);
					this.createArtifact(artifact, resolve, reject, area);
				} else if (artifact.type === ArtifactType.SN) {
					this.createSection(artifact, area);
					this.createNotebook(artifact, area);
					resolve(artifact);
				} else if (artifact.type === ArtifactType.S) {
					this.createSection(artifact, area);
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
	 * @returns {Promise} a javascript promise object
	 */
	@autobind
	public create(schema: string[] | string, area: string = NS.notes) {
		return new Promise((resolve: PromiseFn<Binder>, reject: PromiseFn<string>) => {
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
					const artifact = Artifact.factory('fields', {
						section: it,
						root: this.config.dbdir
					});
					this.createSection(artifact, area);
				}, this);
				resolve(this);
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
	 * The thenable resolves to a reference to the Binder instance.
	 *
	 * @returns {Promise} a javascript promise object.
	 */
	@autobind
	public emptyTrash() {
		return new Promise((resolve: PromiseFn<Binder>, reject: PromiseFn<string>) => {
			if (fs.existsSync(this.config.trash) &&
				this.config.trash.endsWith(`/Trash`) &&
				this.config.trash.startsWith(this.config.dbdir)) {
				this.log.info('Emptying trash: ${this.config.trash}');

				fs.remove(this.config.trash, (err: Error) => {
					if (err) {
						reject(err.message);
					}

					this.schema.trash = {};
					fs.mkdirsSync(this.config.trash);
					resolve(this);
				});
			} else {
				reject(`Invalid trash directory, no empty: ${this.config.trash}`);
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
	 * @returns {Promise} a javascript promise object
	 */
	@autobind
	public find(search: string) {
		const regex = new RegExp(search);
		const self = this;

		function searchArtifact(artifact: Artifact) {
			return new Promise((resolve: PromiseFn<Artifact>, reject: PromiseFn<string>) => {
				const filename: string = join(self.config.dbdir, artifact.path());
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

		return new Promise((resolve: PromiseFn<Artifact[]>, reject: PromiseFn<string>) => {
			const promises: Array<Promise<any>> = [];
			for (const artifact of this._artifacts.values()) {
				promises.push(searchArtifact(artifact));
			}

			Promise.all(promises)
				.then((artifacts: Artifact[]) => {
					resolve(artifacts.filter(n => {
						return n != null;
					}));
				})
				.catch((err: Error) => {
					reject(err.message);
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
	 * @param opts {ArtifactSearch} the section/notebook/filename to search
	 * for within the schema.
	 * @param area {string} the namespace area within the schema object to
	 * search.  There are two areas: notes & trash.
	 * @returns {Promise} a javascript promise object.
	 */
	@autobind
	public get(opts: ArtifactSearch, area: string = NS.notes) {
		return new Promise((resolve: PromiseFn<Artifact>, reject: PromiseFn<string>) => {
			const type: ArtifactType = Artifact.isType(opts);

			if (type === ArtifactType.SNA && this.hasArtifact(opts)) {
				const artifact = this._schema[area][opts.section][opts.notebook][opts.filename];
				const absolute = artifact.absolute();

				if (fs.existsSync(absolute) && !artifact.loaded) {
					const inp = fs.createReadStream(absolute);

					inp.on('close', () => {
						artifact.loaded = true;
						artifact.makeClean();

						if (!this.recents.contains(artifact)) {
							this.recents.enqueue(artifact);
						}

						fs.stat(absolute, (err, stats) => {
							if (err) {
								reject(err.message);
							}

							this.loadMetadata(artifact, stats);
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
					if (!this.recents.contains(artifact)) {
						this.recents.enqueue(artifact);
					}
					resolve(artifact);
				}
			} else if ((type === ArtifactType.SN && this.hasNotebook(opts, area)) ||
				(type === ArtifactType.S && this.hasSection(opts, area))) {
				const artifact = Artifact.factory('fields', opts);
				artifact.root = this.config.dbdir;
				if (!this.recents.contains(artifact)) {
					this.recents.enqueue(artifact);
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
	 * @param search {ArtifactSearch} an object that represents the item to
	 * find in the schema.
	 * @param area {string} the namespace area within the schema object to
	 * search.  There are two areas: notes & trash.
	 * @returns {boolean} true if the artifact is found, otherwise false
	 */
	@autobind
	public hasArtifact(search: ArtifactSearch, area: string = NS.notes): boolean {
		if (this.hasSection(search, area) && this.hasNotebook(search, area)) {

			return Object.prototype.hasOwnProperty
				.call(this.schema[area][search.section][search.notebook], search.filename);
		}

		return false;
	}

	/**
	 * Checks the given section for the existence of a notebook by name.
	 * @param search {ArtifactSearch} an object that represents the item to
	 * find in the schema.
	 * @param area {string} the namespace area within the schema object to
	 * search.  There are two areas: notes & trash.
	 * @returns {boolean} true if the notebook is found, otherwise false
	 */
	@autobind
	public hasNotebook(search: ArtifactSearch, area: string = NS.notes): boolean {
		if (this.schema.hasOwnProperty(area)) {
			if (this.schema[area].hasOwnProperty(search.section)) {
				return Object.prototype.hasOwnProperty
					.call(this.schema[area][search.section], search.notebook);
			}
		}

		return false;
	}

	/**
	 * Checks the current schema for the existence of a section.
	 * @param search {ArtifactSearch} an object that represents the item to
	 * find in the schema.
	 * @param area {string} the namespace area within the schema object to
	 * search.  There are two areas: notes & trash.
	 * @return {boolean} true if the section is found, otherwise false.
	 */
	@autobind
	public hasSection(search: ArtifactSearch, area: string = NS.notes): boolean {
		if (this.schema.hasOwnProperty(area)) {
			return Object.prototype.hasOwnProperty.call(this.schema[area], search.section);
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
	 * @returns {Array} a list of notebook names as strings
	 */
	@autobind
	public notebooks(sectionName: string, area: string = NS.notes): string[] {
		const notebooks: string[] = [];

		if (!this.initialized) {
			throw new Error('Trying to retrieve notebooks from an unitialized database.');
		}

		if (this.hasSection({section: sectionName}, area)) {
			_.forOwn(this.schema[area][sectionName], (value: any, key: string) => {
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
	 * @returns {Promise} a javascript promise object.
	 */
	@autobind
	public reload(area: string = NS.notes) {
		return new Promise((resolve: PromiseFn<Binder>, reject: PromiseFn<string>) => {
			this.initialized = false;
			try {
				this.load(area);
				resolve(this);
			} catch (err) {
				reject(err.message);
			}
		});
	}

	/**
	 * Immediately removes an section/notebook/artifact from the system.
	 *
	 * The thenable resolves to a reference to the Binder instance.
	 *
	 * @param opts {ArtifactSearch} the section/notebook/filename to search
	 * for within the schema.
	 * @param area {string} the namespace area within the schema object to
	 * search.  There are two areas: notes & trash.
	 * @returns {Promise} a javascript promise object
	 */
	@autobind
	public remove(opts: ArtifactSearch, area: string = NS.notes) {
		return new Promise((resolve: PromiseFn<Binder>, reject: PromiseFn<string>) => {
			this.get(opts)
				.then((artifact: Artifact) => {
					switch (artifact.type) {
						case ArtifactType.SNA:
							this._artifacts.delete(artifact.path());
							this.recents.eject(artifact);
							delete this.schema[area][artifact.section][artifact.notebook][artifact.filename];
							break;

						case ArtifactType.SN:
							delete this.schema[area][artifact.section][artifact.notebook];
							break;

						case ArtifactType.S:
							delete this.schema[area][artifact.section];
							break;

						default:
							reject('Invalid artifact type given in remove');
							break;
					}

					fs.remove(artifact.absolute(), err => {
						if (err) {
							reject(err.message);
						}

						resolve(this);
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
	 * @param src {ArtifactSearch} the source artifact that will be changed
	 * @param dst {ArtifactSearch} the destination artifact that the source
	 * will be changed into.
	 * @returns {Promise} a javascript promise object.
	 */
	@autobind
	public rename(src: ArtifactSearch, dst: ArtifactSearch) {
		return new Promise((resolve: PromiseFn<Artifact>, reject: PromiseFn<string>) => {
			let srcArtifact: Artifact = null;
			let dstArtifact: Artifact = null;

			if (Artifact.isDuplicateSearch(src, dst)) {
				reject(`No difference between artifacts in rename request`);
			}

			this.get(src)
				.then((artifact: Artifact) => {
					srcArtifact = artifact;
					if (srcArtifact.type !== Artifact.isType(dst)) {
						reject('SRC artifact type does not match DST');
					}
					return this.add(dst);
				})
				.then((artifact: Artifact) => {
					dstArtifact = artifact;
					dstArtifact.meta = _.cloneDeep(srcArtifact.meta);
					dstArtifact.buf = srcArtifact.buf;
					dstArtifact.makeDirty();
				})
				.then(() => {
					return this.remove(srcArtifact);
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
	 * @param opts {ArtifactSearch} The section/notebook/filename to restore
	 * @returns {Promise} a javascript promise object.
	 */
	@autobind
	public restore(opts: ArtifactSearch) {
		return new Promise((resolve: PromiseFn<Artifact>, reject: PromiseFn<string>) => {
			const dstArtifact: Artifact = Artifact.factory('fields', opts);
			dstArtifact.root = this.config.dbdir;
			const srcArtifact: Artifact = dstArtifact.clone();
			srcArtifact.root = join(this.config.dbdir, 'Trash');

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
				this.reload()
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
	 * The thenable resolves to a reference to the Binder instance.
	 * @returns {Promise} a javascript promise object
	 */
	@autobind
	public save() {
		return new Promise((resolve: PromiseFn<Binder>, reject: PromiseFn<string>) => {
			try {
				this.saveBinder((err: Error) => {
					if (err) {
						reject(err.message);
					}

					resolve(this);
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
	@autobind
	public saveArtifact(artifact: Artifact) {
		return new Promise((resolve: PromiseFn<Artifact>, reject: PromiseFn<string>) => {
			if (artifact.isDirty()) {

				// Keep an eye on this function if there are save issues.  When a promise is
				// not yet fulfilled, and a save occurs, then the file may show as empty as
				// buffered output is not yet written while waiting for the save promise to
				// finish.  If the app crashes before this sync finishes, then data loss
				// may occur.  May need to make this the sync version and trade off performance

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
	 * @returns {Array} a list of section names as strings
	 */
	@autobind
	public sections(area: string = NS.notes): string[] {
		const sections: string[] = [];

		if (!this.initialized) {
			throw new Error('Trying to retrieve sections from an ' +
				'unitialized database.');
		}

		_.forOwn(this.schema[area], (value: any, key: string) => {
			value.toString();
			sections.push(key);
		});

		return (sections);
	}

	/**
	 * Called when the database is no longer needed.  This will cleanup
	 * operations and shutdown the intervals.
	 * @returns {Promise} a javascript promise object
	 */
	@autobind
	public shutdown() {
		return new Promise((resolve: PromiseFn<string>, reject: PromiseFn<string>) => {
			try {
				this.saveBinder((err: Error) => {
					if (err) {
						reject(err.message);
					}

					if (this._fnSaveInterval != null) {
						clearInterval(this._fnSaveInterval);
						this._fnSaveInterval = null;
					}

					this.initialized = false;
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
	 */
	@autobind
	public toString() {
		const obj = {
			config: this.config,
			schema: this.schema
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
	 * @param opts {ArtifactSearch} the section/notebook/filename to remove
	 * for within the schema.
	 * @returns {Promise} a javascript promise object.
	 */
	@autobind
	public trash(opts: ArtifactSearch) {
		this.createTrash();
		return new Promise((resolve: PromiseFn<Artifact>, reject: PromiseFn<string>) => {
			this.get(opts)
				.then((srcArtifact: Artifact) => {
					const dstArtifact: Artifact = srcArtifact.clone();
					dstArtifact.root = join(this.config.dbdir, 'Trash');
					if (fs.existsSync(dstArtifact.absolute())) {
						dstArtifact.makeUnique();
					}

					fs.move(srcArtifact.absolute(), dstArtifact.absolute(), (err: Error) => {
						if (err) {
							reject(err.message);
						}

						this.remove(srcArtifact)
							.then((adb: Binder) => {
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

	get binderName(): string {
		return this._config.binderName;
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

	get log(): any {
		return this._log;
	}

	get meta(): NotesMeta {
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
	 * @private
	 */
	@autobind
	private addArtifact(artifact: Artifact, area: string = NS.notes) {
		if (artifact.hasSection() &&
			artifact.hasNotebook() &&
			artifact.hasFilename() &&
			!this.hasArtifact(artifact, area)) {
			if (this.isValidName(artifact.filename)) {
				this.loadMetadata(artifact);
				this.schema[area][artifact.section][artifact.notebook][artifact.filename] = artifact;

				if (area !== NS.trash) {
					this._artifacts.set(artifact.path(), artifact);
				}
			} else {
				throw new Error(`Invalid filename name '${artifact.filename}'.  Can only use '${validNameChars}'.`);
			}
		}

		return this;
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
	 * @private
	 */
	@autobind
	private createArtifact(artifact: Artifact, resolve: PromiseFn<Artifact>, reject: PromiseFn<string>, area: string = NS.notes) {
		if (artifact.hasSection() &&
			artifact.hasNotebook() &&
			artifact.hasFilename() &&
			!this.hasArtifact(artifact)) {
			if (this.isValidName(artifact.filename)) {
				let dst = join(this.config.dbdir, artifact.path());
				if (area === NS.trash) {
					dst = join(this.config.dbdir, 'Trash', artifact.path());
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
					this.loadMetadata(artifact, stats);
					this.schema[area][artifact.section][artifact.notebook][artifact.filename] = artifact;

					if (area !== NS.trash) {
						this._artifacts.set(artifact.path(), artifact);
					}

					this.log.info(`Added artifact: ${artifact.filename}`);
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
	 * @param opts {BinderOpts} parameters used to instantiate this object.
	 * @returns {ConfigDB} a newly populated configuration object
	 * @private
	 */
	private createInitialConfig(opts: BinderOpts): ConfigDB {
		const configFile: string = join(opts.configRoot || './', 'config.json');
		const metaFile: string = join(opts.configRoot || './', 'meta.json');

		return {
			binderName: opts.binderName || 'adb',
			configFile: configFile,
			configRoot: opts.configRoot,
			dbdir: join(opts.root || './', opts.binderName || 'adb'),
			trash: join(opts.root || './', opts.binderName || 'adb', 'Trash'),
			metaFile: metaFile,
			logdir: join(path.dirname(configFile || './')),
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
	 * @returns {Binder} a reference to the changed DB instance
	 * @private
	 */
	@autobind
	private createNotebook(artifact: Artifact, area: string = NS.notes) {
		if (artifact.hasSection() && artifact.hasNotebook() &&
			this.hasSection(artifact, area) &&
			!this.hasNotebook(artifact, area)) {
			if (this.isValidName(artifact.notebook)) {
				let dst = join(this.config.dbdir, artifact.section, artifact.notebook);
				if (area === NS.trash) {
					dst = join(this.config.dbdir, 'Trash', artifact.section, artifact.notebook);
				}

				if (!fs.existsSync(dst)) {
					this.log.info(`Creating notebook: ${artifact.notebook} in section ${artifact.section}`);
					fs.mkdirsSync(dst);
				}

				if (!this.hasNotebook(artifact, area) && fs.existsSync(dst) && fs.lstatSync(dst).isDirectory()) {
					this.schema[area][artifact.section][artifact.notebook] = {};
				}

				return (this);
			} else { // eslint-disable-line no-else-return
				throw new Error(`Invalid notebook name '${artifact.notebook}'.  Can only use '${validNameChars}'.`);
			}
		}

		return this;
	}

	/**
	 * Creates a new section (directory) within the database.  If the section
	 * already exists, then the call is ignored.
	 * @param artifact {Artifact} the name of the section to create.
	 * @param area {string} the namespace area within the schema object to
	 * search.  There are two areas: notes & trash.
	 * @returns {Binder} a reference to the changed DB instance
	 * @private
	 */
	@autobind
	private createSection(artifact: Artifact, area: string = NS.notes) {
		if (!this.hasSection(artifact, area)) {
			if (this.isValidName(artifact.section)) {
				let dst = join(this.config.dbdir, artifact.section);
				if (area === NS.trash) {
					dst = join(this.config.dbdir, 'Trash', artifact.section);
				}

				if (!fs.existsSync(dst)) {
					this.log.info(`Creating section: ${artifact.section}`);
					fs.mkdirsSync(dst);
				}

				if (!this.hasSection(artifact, area) &&
					fs.existsSync(dst) &&
					fs.lstatSync(dst).isDirectory()) {
					this.schema[area][artifact.section] = {};
				}

				return this;
			} else { // eslint-disable-line no-else-return
				throw new Error(`Invalid section name '${artifact.section}'.  Can only use '${validNameChars}'.`);
			}
		}

		return this;
	}

	/**
	 * Creates the trash directory within the binder.
	 * @private
	 */
	@autobind
	private createTrash() {
		const trashDir = join(this.config.dbdir, 'Trash');

		if (!fs.existsSync(trashDir)) {
			fs.mkdirs(trashDir);
		}
	}

	/**
	 * The directories within the db must follow a simple name check.  It must
	 * pass the following regex: /^\w+$/
	 * @param str {string} the name of the database, section, or notebook
	 * @returns {boolean} true if the name is ok, otherwise false
	 * @private
	 */
	@autobind
	private isValidName(str: string) {
		return this.reID.test(str);
	}

	/**
	 * This is called after the database instance is instantiated.  This is an
	 * async call that precedes all other calls.  This ensures that it is
	 * asynchronously loaded before it is used.  Once initialized, it is not
	 * reloaded.
	 * @param area {string} the namespace area within the schema object to
	 * search.  There are two areas: notes & trash.
	 * @private
	 */
	@autobind
	private load(area: string = NS.notes) {
		this.validate();
		this.createTrash();
		this.loadBinder(area);
		this.saveBinder();

		this.log.info(`Loaded database '${this.config.binderName}' for ${area}.`);
		this.initialized = true;
	}

	/**
	 * Loads an existing text DB from the file system.  It finds the database by
	 * reading the configuration stored in this.  If there is no configuration
	 * information when this is called, then it does nothing.
	 * @param area {string} the namespace area within the schema object to
	 * search.  There are two areas: notes & trash.
	 * @private
	 */
	@autobind
	private loadBinder(area: string = NS.notes) {
		let directory = '';
		const trashIndex = this.ignore.indexOf('Trash');

		if (area === NS.trash) {
			directory = 'Trash';
			if (trashIndex !== -1) {
				this.ignore.splice(trashIndex, 1);
			}
		} else {
			if (trashIndex === -1) {
				this.ignore.push('Trash');
			}
		}

		this.tree(directory).forEach((it: string) => {
			const artifact = Artifact.factory('treeitem', {
				treeitem: it,
				root: this.config.dbdir
			});
			this.createSection(artifact, area);
			this.createNotebook(artifact, area);
			this.addArtifact(artifact, area);
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
	 * @private
	 */
	@autobind
	private loadMetadata(artifact: Artifact, stats: fs.Stats = null): void {
		if (artifact instanceof Artifact) {
			if (artifact.path() in this.meta) {
				artifact.meta = this.meta[artifact.path()];
			} else {
				this.meta[artifact.path()] = artifact.meta;
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
	 * @private
	 */
	@autobind
	private saveBinder(cb: INilCallback = nil) {
		const promises: any = [];

		promises.push(new Promise((resolve: PromiseFn<string>, reject: PromiseFn<string>) => {
			try {
				this.log.info(`Saving configuration: ${this.config.configFile}`);
				const data = JSON.stringify(this.config, null, '\t');
				fs.writeFileSync(this.config.configFile, data);
				resolve('Configuration saved');
			} catch (err) {
				reject(`Error saving configuration: ${err.message}`);
			}
		}));

		promises.push(new Promise((resolve: PromiseFn<string>, reject: PromiseFn<string>) => {
			try {
				this.log.info(`Saving meta data: ${this.config.metaFile}`);
				const data = JSON.stringify(this.meta, null, '\t');
				fs.writeFileSync(this.config.metaFile, data);
				resolve('Wrote metadata');
			} catch (err) {
				reject(`Error saving metadata: ${err.message}`);
			}
		}));

		for (const artifact of this.artifacts.values()) {
			promises.push(this.saveArtifact(artifact));
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
	 * @returns {Array} a list of nodes/directories in the database tree.
	 * @private
	 */
	@autobind
	private tree(directory: string = '') {
		directory = (directory === '') ? this.config.dbdir : join(this.config.dbdir, directory);
		const l: string[] = [];

		if (fs.existsSync(directory)) {

			// For each file retrieved by klaw-sync, check to see if it
			// is in the ignore list.  If a file should be included, then true
			// is returned, otherwise false.
			const filterFn = (item: any) => {
				return this.ignore.every((it: string) => {
					return (item.path.indexOf(it) > -1) ? false : true;
				});
			};

			const files = walk(directory, {
				filter: filterFn,
				noRecurseOnFailedFilter: true
			});

			files.forEach((file: any) => {
				l.push(normalize(file.path).replace(`${directory}/`, ''));
			}, this);
		}

		return l;
	}

	/**
	 * Checks the binder configuration to ensure that it is valid
	 * @private
	 */
	@autobind
	private validate() {
		if (!fs.existsSync(this.config.configFile)) {
			throw new Error(`Can't find notesdb configuration: ${this.config.configFile}.`);
		}

		if (typeof this.config.dbdir !== 'string' || this.config.dbdir == null || this.config.dbdir === '') {
			throw new Error('The database directory is missing from configuration.');
		}

		if (!fs.existsSync(this.config.dbdir)) {
			throw new Error(`No notesdb located @ ${this.config.dbdir}.`);
		}
	}
}
