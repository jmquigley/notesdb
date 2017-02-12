const path = require('path');

/**
 * A container class that holds the information for a single artifact within
 * the database.
 */
class Artifact {

	constructor() {
		this._section = 'Default';
		this._notebook = 'Default';
		this._filename = '';
		this._type = '';
		this._loaded = false;
		this._dirty = false;
		this._buf = [];
		this._created = '';
		this._updated = '';
		this._tags = [];
		this._layout = {};
	}

	/**
	 * A factory method for creating different types of artifacts.  The mode
	 * determines what type of Artifact object will be factory and returned.
	 * The types include:
	 *
	 * - all|default - use a object with properties for each field to factory the object
	 * and set its properties
	 * - treeitem - represents an object that can be parsed in the treetitem
	 * format of {section}/{notebook}/{filename}
	 * - empty - just return an empty object.  This is the default.
	 *
	 * @param mode {string} tells the factory what to make
	 * @param [args] {Object|string} parameters to the facility that will make
	 * the object.
	 * @returns {Artifact} a newly constructed artifact object.
	 */
	static factory(mode = 'empty', args = '') {
		let artifact = new Artifact();
		let a = '';

		switch (mode) {
			case 'treeitem':
				a = args.split(path.sep);

				artifact._section = a[0] || 'Default';
				artifact._notebook = a[1] || 'Default';
				artifact._filename = a[2] || '';
				break;

			case 'all':
				if (args instanceof Object) {
					if (Object.prototype.hasOwnProperty.call(args, 'section')) {
						artifact._section = args.section;
					}

					if (Object.prototype.hasOwnProperty.call(args, 'notebook')) {
						artifact._notebook = args.notebook;
					}

					if (Object.prototype.hasOwnProperty.call(args, 'filename')) {
						artifact._filename = args.filename;
					}
				}
				break;

			case 'empty':
			case 'default':
			default:
				break;
		}

		return artifact;
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

	info() {
		return `${this.section}|${this.notebook}|${this.filename}`;
	}

	isDirty() {
		return this._dirty;
	}

	isEmpty() {
		return (this.section === '' && this.notebook === '' && this.filename === '');
	}

	isLoaded() {
		return this._loaded;
	}

	makeClean() {
		this._dirty = false;
	}

	makeDirty() {
		this._dirty = true;
	}

	path() {
		return path.join(this.section, this.notebook, this.filename);
	}

	toString() {
		return JSON.stringify(this, null, 2);
	}

	//
	// Properties
	//

	get buffer() {
		return Buffer.from(this._buf);
	}

	get created() {
		return this._created;
	}

	get filename() {
		return this._filename;
	}

	get layout() {
		return this._layout;
	}
	set loaded(val) {
		this._loaded = val;
	}

	get notebook() {
		return this._notebook;
	}

	get section() {
		return this._section;
	}

	get tags() {
		return this._tags;
	}

	get type() {
		return this._type;
	}

	get updated() {
		return this._updated;
	}
}

module.exports = Artifact;
