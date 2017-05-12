/**
 * This module contains a class that manages multiple Binder
 * instances.
 *
 */

'use strict';

import {EventEmitter} from 'events';
import * as fs from 'fs-extra';
import {home} from 'util.home';
import {join} from 'util.join';
import logger, {Logger} from 'util.log';
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

	private _baseDirectory: string;
	private _binderDirectory: string;
	private _binders: IBinders = {};
	private _log: Logger = null;
	private _opts: IBinderManagerOpts = {
		defaultName: 'default',
		defaultDirectory: join(home, 'Satchel', 'default')
	};

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
		self._binderDirectory = join(baseDirectory, 'binders');
		if (!fs.existsSync(self._binderDirectory)) {
			fs.mkdirs(self._binderDirectory);
		}

		self._log = logger.instance({
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

	/**
	 * Adds a new Binder instance to the manager.  This will only add the binder if
	 * it doesn't exist.
	 * @param binderName {string} The name of the binder to create
	 * @param binderDirectory {string} The location of the data files for this binder
	 * @returns success if the add works, otherwise false.
	 */
	public add(binderName: string, binderDirectory: string, self = this) {
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
	 * Retrieves a Binder instance from the manager by name.
	 * @param binderName {string} The name of the binder to find.
	 * @returns {Binder} a reference to the binder within the manager.  If it doesn't exist
	 * then undefined is returned.
	 */
	public get(binderName: string, self = this): Binder {
		self.log.info(`Retrieving binder '${binderName}'`);
		return self._binders[binderName];
	}

	// :TODO: info()
	// :TODO: list()
	// :TODO: remove()

	get bindersDirectory(): string {
		return this._binderDirectory;
	}

	get log(): any {
		return this._log;
	}

	/**
	 * Reads all of the binders in given binder directory, attemps to instantiate them,
	 * and save their references in the _binders array.
	 * @param self {BinderManager} reference to the current instance of this class
	 */
	private load(self = this) {
		const l = getDirectories(self.bindersDirectory);

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
