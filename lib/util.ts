/**
 * This module contains helper functions used in the txtdb.  They represent
 * private functions that are not exposed as part of the main module.
 *
 * @module util
 */
'use strict';

import * as fs from 'fs-extra';
import * as path from 'path';
import * as uuid from 'uuid';

/**
 * Retrieves a list of directories from the given input path.
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
		return uuid.v4().replace(/-/g, '');
	}

	return uuid.v4();
}
