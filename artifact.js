/**
 * A container class that holds the information for a single artifact within
 * the database.
 */
class Artifact {
	constructor(section = '', notebook = '', filename = '') {
		this._section = section;
		this._notebook = notebook;
		this._filename = filename;
		this._type = '';
		this._dirty = false;
		this._buf = null;
		this._created = '';
		this._updated = '';
		this._tags = [];
		this._layout = {};
	}

	hasFilename() {
		return this.filename !== '';
	}

	hasNotebook() {
		return this.notebook !== '';
	}

	hasSection() {
		return this.section !== '';
	}

	isDirty() {
		return this._dirty;
	}

	isEmpty() {
		return (this.section === '' && this.notebook === '' && this.filename === '');
	}

	makeClean() {
		this._dirty = false;
	}

	makeDirty() {
		this._dirty = true;
	}

	get filename() {
		return this._filename;
	}

	get notebook() {
		return this._notebook;
	}

	get section() {
		return this._section;
	}
}

module.exports = Artifact;
