import * as path from 'path';

interface IArtifactOpts {
	section: string;
	notebook: string;
	filename: string;
}

/**
 * A container class that holds the information for a single artifact within
 * the database.
 */
export class Artifact {

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
	 * @param [opts] {Object|string} parameters to the facility that will make
	 * the object.
	 * @returns {Artifact} a newly constructed artifact object.
	 */
	public static factory(mode: string = 'empty', opts: any = {}): Artifact {
		let artifact = new Artifact();
		let a: string[] = [];

		switch (mode) {
			case 'treeitem':
				a = opts.split(path.sep);

				artifact._section = a[0] || 'Default';
				artifact._notebook = a[1] || 'Default';
				artifact._filename = a[2] || '';
				break;

			case 'all':
				let args: IArtifactOpts = opts;
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

	private _section: string = 'Default';
	private _notebook: string = 'Default';
	private _filename: string = '';
	private _type: string = '';
	private _loaded: boolean = false;
	private _dirty: boolean = false;
	private _buf: any = [];
	private _created: string = '';
	private _updated: string = '';
	private _tags: string[] = [];
	private _layout: any = {};

	constructor() {}

	public hasFilename() {
		return this.filename !== '';
	}

	public hasNotebook() {
		return this.notebook !== '';
	}

	public hasSection() {
		return this.section !== '';
	}

	public info() {
		return `${this.section}|${this.notebook}|${this.filename}`;
	}

	public isDirty() {
		return this._dirty;
	}

	public isEmpty() {
		return (this.section === '' && this.notebook === '' && this.filename === '');
	}

	public makeClean() {
		this._dirty = false;
	}

	public makeDirty() {
		this._dirty = true;
	}

	public path() {
		return path.join(this.section, this.notebook, this.filename);
	}

	public toString() {
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

	set loaded(val: boolean) {
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
