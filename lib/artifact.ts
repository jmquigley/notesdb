import * as path from 'path';
import * as fs from 'fs-extra';

export interface IArtifactOpts {
	root?: string;
	treeitem?: string;
	section?: string;
	notebook?: string;
	filename?: string;
}

export const enum ArtifactType {
	Unk = 0,  // 0000b - Unknown type
	S   = 1,  // 0001b - Section only
	SN  = 3,  // 0011b - Section and notebook
	SNA = 7   // 0111b - Section, notebook, and artifact
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
	public static factory(mode?: string, opts: IArtifactOpts = {}): Artifact {
		let artifact = new Artifact();
		let a: string[] = [];

		if (mode == null) {
			mode = 'empty';
		}

		switch (mode) {
			case 'treeitem':
				if (Object.prototype.hasOwnProperty.call(opts, 'treeitem')) {
					let s: string = opts.treeitem || '';
					a = s.split(path.sep);

					artifact.section = a[0] || 'Default';
					artifact.notebook = a[1] || 'Default';
					artifact.filename = a[2] || '';
				}

				if (Object.prototype.hasOwnProperty.call(opts, 'root')) {
					artifact.root = opts.root;
				}
				break;

			case 'all':
				let args: IArtifactOpts = opts || {};
				if (Object.prototype.hasOwnProperty.call(args, 'section')) {
					artifact.section = args.section || 'Default';
				}

				if (Object.prototype.hasOwnProperty.call(args, 'notebook')) {
					artifact.notebook = args.notebook || 'Default';
				}

				if (Object.prototype.hasOwnProperty.call(args, 'filename')) {
					artifact.filename = args.filename || '';
				}

				if (Object.prototype.hasOwnProperty.call(args, 'root')) {
					artifact.root = args.root;
				}

				break;

			case 'empty':
			case 'default':
			default:
				break;
		}

		if (artifact.section !== '') {
			artifact.type |= 1;  // Set section bit of type
		}

		if (artifact.notebook !== '') {
			artifact.type |= 2;  // set notebook bit of type
		}

		if (artifact.filename !== '') {
			artifact.type |= 4;  // set filename bit of type
		}

		return artifact;
	}

	private _section: string = '';
	private _notebook: string = '';
	private _filename: string = '';
	private _root: string = '';
	private _type: ArtifactType = ArtifactType.Unk;
	private _loaded: boolean = false;
	private _dirty: boolean = false;
	private _buf: any = [];
	private _created: string = '';
	private _updated: string = '';
	private _tags: string[] = [];
	private _layout: any = {};

	constructor() {}

	public hasFilename(): boolean {
		return this.filename !== '';
	}

	public hasNotebook(): boolean {
		return this.notebook !== '';
	}

	public hasSection(): boolean {
		return this.section !== '';
	}

	public info(): string {
		return `${this.section}|${this.notebook}|${this.filename}`;
	}

	public isDirty(): boolean {
		return this._dirty;
	}

	public isEmtpy(): boolean {
		return this._section === '' && this._notebook === '' && this._filename === '';
	}

	public makeClean() {
		this._dirty = false;
	}

	public makeDirty() {
		this._dirty = true;
	}

	public path(): string {
		return path.join(this.section, this.notebook, this.filename);
	}

	public toString(): string {
		return JSON.stringify(this, null, 2);
	}

	//
	// Properties
	//

	get buffer(): Buffer {
		return Buffer.from(this._buf);
	}

	get created() {
		return this._created;
	}

	get filename(): string {
		return this._filename;
	}

	set filename(val: string) {
		this._filename = val;
	}

	get layout() {
		return this._layout;
	}

	get loaded(): boolean {
		return this._loaded;
	}

	set loaded(val: boolean) {
		this._loaded = val;
	}

	get notebook(): string {
		return this._notebook;
	}

	set notebook(val: string) {
		this._notebook = val;
	}

	get root() {
		return this._root;
	}

	set root(val) {
		if (fs.existsSync(val)) {
			this._root = val;
		} else {
			throw new Error(`Invalid root path for artifact: ${val}`);
		}
	}

	get section(): string {
		return this._section;
	}

	set section(val: string) {
		this._section = val;
	}

	get tags() {
		return this._tags;
	}

	get type(): ArtifactType {
		return this._type;
	}

	set type(val: ArtifactType) {
		this._type = val;
	}

	get updated() {
		return this._updated;
	}
}
