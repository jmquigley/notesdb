/**
 * This module contains a class that manages multiple Binder
 * instances.
 *
 */

'use strict';

import {EventEmitter} from 'events';
import * as fs from 'fs-extra';
import {join} from 'util.join';
import logger, {Logger} from 'util.log';
import {Binder} from './binder';

const pkg = require('../package.json');

/** Creates an instance of the binder management class */
export class BinderManager extends EventEmitter {

	private _baseDirectory: string;
	private _binderDirectory: string;
	private _log: Logger = null;

	constructor(baseDirectory: string) {
		super();

		const self = this;
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

		self.log('Initializing the binder manager instance.');
	}

	public add(binderName: string, self = this) {
		self.log(`Adding binder: ${binderName}`);
	}

	public get(binderName: string, self = this): Binder {
		self.log(`Retrieving binder: ${binderName}`);
		return null;
	}

	get log(): any {
		return this._log;
	}
}
