/**
 * This module contains a class that manages multiple Binder
 * instances.
 *
 */

'use strict';

import autobind from 'autobind-decorator';
import {EventEmitter} from 'events';
import * as fs from 'fs-extra';
import * as rimraf from 'rimraf';
import {home} from 'util.home';
import {join} from 'util.join';
import logger, {Logger} from 'util.log';
import {timestamp as ts} from 'util.timestamp';
import {
	failure,
	getDirectories,
	success
} from 'util.toolbox';
import {Binder} from './binder';

const pkg = require('../package.json');

export interface Binders {
	[key: string]: Binder;
}

export interface BinderManagerOpts {
	defaultName?: string;
	defaultDirectory?: string;
}

/** Creates an instance of the binder management class */
export class BinderManager extends EventEmitter {

	private log: Logger = null;

	private _baseDirectory: string;
	private _bindersDirectory: string;
	private _binders: Binders = {};
	private _opts: BinderManagerOpts = {
		defaultName: 'default',
		defaultDirectory: join(home, 'Binders')
	};
	private _trashDirectory: string;

	/**
	 * Creates a new instance of the BinderManager class.  An instance is used
	 * to manage multiple binder instances and centralize their configuration
	 * details.
	 *
	 * The baseDirectory option points to a directory that will hold another sub
	 * directory named "binders".  Each of these directories hold the configuration
	 * details for a single Binder.
	 *
	 * @constructor
	 * @extends EventEmitter
	 * @param baseDirectory {string} the location where all of the notebook configurations
	 * that are managed by this instance are stored.
	 */
	constructor(baseDirectory: string, opts?: BinderManagerOpts) {
		super();

		this._opts = Object.assign(this._opts, opts);
		this._baseDirectory = baseDirectory;
		this._bindersDirectory = join(baseDirectory, 'binders');
		this._trashDirectory = join(baseDirectory, 'binders', 'Trash');

		if (!fs.existsSync(this._bindersDirectory)) {
			fs.mkdirsSync(this._bindersDirectory);
		}

		if (!fs.existsSync(this._trashDirectory)) {
			fs.mkdirsSync(this._trashDirectory);
		}

		this.log = logger.instance({
			debug: pkg.debug,
			toConsole: false,
			directory: baseDirectory,
			eventFile: null,
			messageFile: 'manager.log',
			namespace: 'notesdb_manager'
		});

		this.log.info('Initializing the binder manager instance.');
		this.load();
		this.emit('loaded', this);
	}

	get baseDirectory(): string {
		return this._baseDirectory;
	}

	get bindersDirectory(): string {
		return this._bindersDirectory;
	}

	get trashDirectory(): string {
		return this._trashDirectory;
	}

	/**
	 * Adds a new Binder instance to the manager.  This will only add the binder if
	 * it doesn't exist.
	 * @param binderName {string} The name of the binder to create
	 * @param binderDirectory {string} The location of the data files for this binder
	 * @returns success if the add works, otherwise failure.
	 */
	@autobind
	public add(binderName: string, binderDirectory: string): number {
		this.log.info(`Adding binder '${binderName}' to ${binderDirectory}`);

		const configRoot = join(this.bindersDirectory, binderName);
		if (!fs.existsSync(configRoot)) {
			try {
				const adb: Binder = new Binder({
					binderName: binderName,
					configRoot: configRoot,
					root: binderDirectory
				});
				this.log.debug(`Adding binder '${adb.binderName}' to manager`);
				this._binders[binderName] = adb;
			} catch (err) {
				this.log.error(err.message);
				return failure;
			}
		} else {
			this.log.warn('Binder already exists, will not add a new one');
			return failure;
		}

		return success;
	}

	/**
	 * Permanently removes the contents of the `Trash` directory.  This directory
	 * is filled by the `remove()`.
	 * @returns {string[]} an array containing the directories that were removed.
	 */
	@autobind
	public emptyTrash(): string[] {
		const dirs: string[] = getDirectories(this.trashDirectory).map((directory: string) => {
			return join(this.trashDirectory, directory);
		});

		dirs.forEach((directory: string) => {
			rimraf.sync(directory);
		});

		return dirs;
	}

	/**
	 * Retrieves a Binder instance from the manager by name.
	 * @param binderName {string} The name of the binder to find.
	 * then undefined is returned.
	 */
	@autobind
	public get(binderName: string): Binder {
		this.log.info(`Retrieving binder '${binderName}'`);
		return this._binders[binderName];
	}

	/**
	 * Checks the current binder list for the existence of the requested
	 * binder.
	 * @param binderName {string} The name of the binder to find.
	 * @returns {boolean} true if the binder is found within the manager otherwise
	 * false.
	 */
	@autobind
	public hasBinder(binderName: string): boolean {
		if (this.list().indexOf(binderName) === -1) {
			return false;
		}

		return true;
	}

	/**
	 * Retrieves information about each of the binders under control of the manager
	 * @returns {string} a string representing each of the binders in the manager
	 */
	@autobind
	public info(): string {
		const l: string[] = ['Binder Info'];

		for (const key in this._binders) {
			if (this._binders.hasOwnProperty(key)) {
				l.push(`* ${key}`);
				l.push(`${JSON.stringify(this._binders[key].config, null, 4)}\n`);
			}
		}
		l.push('');

		return l.join('\n');
	}

	/**
	 * Retrieves the list of binders under control of this manager.  The trash folder
	 * is excluded from the list.
	 * @returns an array of strings that represent the binder names.  If there are no
	 * binders, then an empty array is returned.
	 */
	@autobind
	public list(): string[] {
		return getDirectories(this.bindersDirectory).filter(binderName => {
			return binderName !== 'Trash';
		});
	}

	/**
	 * Moves the given binder name to the Trash directory.  A timestamp is added
	 * to the name of the moved binder.  If the binder doean't exist, then a warning
	 * message is written to the manager log file.
	 * @param binderName {string} the name of the binder that will be moved
	 * @return {string} the path to the newly removed item (to the trash)
	 */
	@autobind
	public remove(binderName: string): string {
		const src: string = join(this.bindersDirectory, binderName);
		const dst: string = join(this.bindersDirectory, 'Trash', `${binderName}-${ts()}`);
		if (fs.existsSync(src)) {
			fs.moveSync(src, dst);
		} else {
			this.log.warn(`${binderName} doesn't exist to remove`);
			return '';
		}

		return dst;
	}

	/**
	 * Iterates through all binder instances and calls their shutdown
	 * methods.
	 */
	@autobind
	public shutdown() {
		for (const name in this._binders) {
			if (this._binders.hasOwnProperty(name)) {
				const adb = this._binders[name];

				this.log.info(`Shutdown binder ${name}`);
				adb.shutdown()
				.then((message: string) => {
					this.log.info(`${name}: ${message}`);
				})
				.catch((err: string) => {
					this.log.error(err);
				});
			}
		}
	}

	/**
	 * Reads all of the binders in given binder directory, attemps to instantiate them,
	 * and save their references in the _binders array.
	 * @private
	 */
	@autobind
	private load() {
		const l = this.list();

		if (l.length === 0) {
			// no binders, so create an empty default
			this.add(this._opts.defaultName, this._opts.defaultDirectory);
		} else {
			l.forEach((directory: string) => {
				const adb: Binder = new Binder({
					configRoot: join(this.bindersDirectory, directory)
				});
				this.log.debug(`Loading binder '${adb.binderName}' into manager`);
				this._binders[adb.binderName] = adb;
			});
		}
	}
}
