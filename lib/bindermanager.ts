/**
 * This module contains a class that manages multiple Binder
 * instances.
 *
 */

'use strict';

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

export interface IBinders {
	[key: string]: Binder;
}

export interface IBinderManagerOpts {
	defaultName?: string;
	defaultDirectory?: string;
}

/** Creates an instance of the binder management class */
export class BinderManager extends EventEmitter {

	private log: Logger = null;

	private _baseDirectory: string;
	private _bindersDirectory: string;
	private _binders: IBinders = {};
	private _opts: IBinderManagerOpts = {
		defaultName: 'default',
		defaultDirectory: join(home, 'Notebooks', 'default')
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
	constructor(baseDirectory: string, opts?: IBinderManagerOpts) {
		super();
		const self = this;

		self._opts = Object.assign(self._opts, opts);
		self._baseDirectory = baseDirectory;
		self._bindersDirectory = join(baseDirectory, 'binders');
		self._trashDirectory = join(baseDirectory, 'binders', 'Trash');

		if (!fs.existsSync(self._bindersDirectory)) {
			fs.mkdirsSync(self._bindersDirectory);
		}

		if (!fs.existsSync(self._trashDirectory)) {
			fs.mkdirsSync(self._trashDirectory);
		}

		self.log = logger.instance({
			debug: pkg.debug,
			toConsole: false,
			directory: baseDirectory,
			eventFile: null,
			messageFile: 'manager.log',
			namespace: 'notesdb_manager'
		});

		self.log.info('Initializing the binder manager instance.');
		self.load();
		self.emit('loaded', self);
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
	 * @param self {BinderManager} reference to the current instance of this class
	 * @returns success if the add works, otherwise failure.
	 */
	public add(binderName: string, binderDirectory: string, self = this): number {
		self.log.info(`Adding binder '${binderName}' to ${binderDirectory}`);

		const configRoot = join(self.bindersDirectory, binderName);
		if (!fs.existsSync(configRoot)) {
			try {
				const adb: Binder = new Binder({
					binderName: binderName,
					configRoot: configRoot,
					root: binderDirectory
				});
				self.log.debug(`Adding binder '${adb.binderName}' to manager`);
				self._binders[binderName] = adb;
			} catch (err) {
				self.log.error(err.message);
				return failure;
			}
		} else {
			self.log.warn('Binder already exists, will not add a new one');
			return failure;
		}

		return success;
	}

	/**
	 * Permanently removes the contents of the `Trash` directory.  This directory
	 * is filled by the `remove()`.
	 * @param self {BinderManager} reference to the current instance of this class
	 * @returns {string[]} an array containing the directories that were removed.
	 */
	public emptyTrash(self = this): string[] {
		const dirs: string[] = getDirectories(self.trashDirectory).map((directory: string) => {
			return join(self.trashDirectory, directory);
		});

		dirs.forEach((directory: string) => {
			rimraf.sync(directory);
		});

		return dirs;
	}

	/**
	 * Retrieves a Binder instance from the manager by name.
	 * @param binderName {string} The name of the binder to find.
	 * @param self {BinderManager} reference to the current instance of this class
	 * @returns {Binder} a reference to the binder within the manager.  If it doesn't exist
	 * then undefined is returned.
	 */
	public get(binderName: string, self = this): Binder {
		self.log.info(`Retrieving binder '${binderName}'`);
		return self._binders[binderName];
	}

	/**
	 * Retrieves information about each of the binders under control of the manager
	 * @param self {BinderManager} reference to the current instance of this class
	 * @returns {string} a string representing each of the binders in the manager
	 */
	public info(self = this): string {
		const l: string[] = ['Binder Info'];

		for (const key in self._binders) {
			if (self._binders.hasOwnProperty(key)) {
				l.push(`* ${key}`);
				l.push(`${JSON.stringify(self._binders[key].config, null, 4)}\n`);
			}
		}
		l.push('');

		return l.join('\n');
	}

	/**
	 * Retrieves the list of binders under control of this manager.  The trash folder
	 * is excluded from the list.
	 * @param self {BinderManager} reference to the current instance of this class
	 * @returns an array of strings that represent the binder names.  If there are no
	 * binders, then an empty array is returned.
	 */
	public list(self = this): string[] {
		return getDirectories(self.bindersDirectory).filter(binderName => {
			return binderName !== 'Trash';
		});
	}

	/**
	 * Moves the given binder name to the Trash directory.  A timestamp is added
	 * to the name of the moved binder.  If the binder doean't exist, then a warning
	 * message is written to the manager log file.
	 * @param binderName {string} the name of the binder that will be moved
	 * @param self {BinderManager} reference to the current instance of this class
	 * @return {string} the path to the newly removed item (to the trash)
	 */
	public remove(binderName: string, self = this): string {
		const src: string = join(self.bindersDirectory, binderName);
		const dst: string = join(self.bindersDirectory, 'Trash', `${binderName}-${ts()}`);
		if (fs.existsSync(src)) {
			fs.moveSync(src, dst);
		} else {
			self.log.warn(`${binderName} doesn't exist to remove`);
			return '';
		}

		return dst;
	}

	/**
	 * Reads all of the binders in given binder directory, attemps to instantiate them,
	 * and save their references in the _binders array.
	 * @private
	 * @param self {BinderManager} reference to the current instance of this class
	 */
	private load(self = this) {
		const l = self.list();

		if (l.length === 0) {
			// no binders, so create an empty default
			self.add(self._opts.defaultName, self._opts.defaultDirectory);
		} else {
			l.forEach((directory: string) => {
				const adb: Binder = new Binder({
					configRoot: join(self.bindersDirectory, directory)
				});
				self.log.debug(`Loading binder '${adb.binderName}' into manager`);
				self._binders[adb.binderName] = adb;
			});
		}
	}
}
