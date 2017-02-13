/**
 * This module contains helper functions used in the txtdb.  They represent
 * private functions that are not exposed as part of the main module.
 *
 * @module
 */
'use strict';

import * as fs from 'fs-extra';
import * as path from 'path';
import {IAppender, IAppenderList} from './notesdb';
const uuidV4 = require('uuid/v4');
const pkg = require('../package.json');

/**
 * Adds a console logging appender to to the logging facility used by the TxtDB
 * class.  It checks to see if there is already a console logger in the config.
 * If it is already there, then it is not added again.
 * @param logger {Logger} a reference to the log4j object.
 */
export function addConsole(logger: IAppenderList) {
	if (pkg.debug) {
		let obj = logger.appenders.filter((appender: IAppender) => {
			return appender.type === 'console';
		})[0];

		if (typeof obj === 'undefined') {
			logger.appenders.push({
				type: 'console',
			});
		}
	}
}

/**
 * Retrieves a list of directoreis from the given input path.
 * @param src {string} the source directory to search for sub directories
 * @returns {Array} a list of directories.
 */
export function getDirectories(src: string): string[] {
	return fs.readdirSync(src)
		.filter((file: string) => fs.statSync(path.join(src, file)).isDirectory());
}

/**
 * Retrieves a version 4 uuid.  It can be with or without the dash characters.
 * @param nodash {boolean} if true, the dashes are removed, otherwise just a
 * v4 uuid is created.
 * @returns {string} a v4 uuid
 */
export function getUUID(nodash = false): string {
	if (nodash) {
		return uuidV4().replace(/-/g, '');
	}

	return uuidV4();
}
