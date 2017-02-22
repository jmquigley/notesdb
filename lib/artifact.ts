import * as path from 'path';
import * as fs from 'fs-extra';

export interface IArtifactSearch {
	section?: string;
	notebook?: string;
	filename?: string;
}

export interface IArtifactOpts extends IArtifactSearch {
	root?: string;
	treeitem?: string;
}

export interface IArtifactMeta {
	accessed: Date;
	created: Date;
	updated: Date;
	tags?: string[];
	layout?: any;
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
	 * Takes artifact search information and builds the type id
	 * @param search {IArtifactSearch} an object that contains the current
	 * Artifact parameters used to build the type id.
	 * @returns {ArtifactType} the id associated with this search.
	 */
	public static isType(search: IArtifactSearch): ArtifactType {
		let n: ArtifactType = ArtifactType.Unk;

		if (search.section != null && search.section !== '') {
			n |= 1;  // Set section bit of type
		}

		if (search.notebook != null && search.notebook !== '') {
			n |= 2;  // set notebook bit of type
		}

		if (search.filename != null && search.filename !== '') {
			n |= 4;  // set filename bit of type
		}

		return n;
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
	 * @param [opts] {Object|string} parameters to the facility that will make
	 * the object.
	 * @returns {Artifact} a newly constructed artifact object.
	 */
	public static factory(mode?: string, opts?: IArtifactOpts): Artifact {
		let artifact = new Artifact();

		let a: string[] = [];

		if (mode == null) {
			mode = 'empty';
		}

		switch (mode) {
			case 'treeitem':
				if (opts != null) {
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
				}
				break;

			case 'all':
				if (opts != null) {
					let args: IArtifactOpts = opts;

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
				}
				break;

			case 'empty':
			case 'default':
			default:
				break;
		}

		artifact.type = Artifact.isType({
			section: artifact.section,
			notebook: artifact.notebook,
			filename: artifact.filename
		});

		return artifact;
	}

	private _section: string = '';
	private _notebook: string = '';
	private _filename: string = '';
	private _root: string = '';
	private _type: ArtifactType = ArtifactType.Unk;
	private _loaded: boolean = false;
	private _dirty: boolean = false;
	private _buf: string = '';
	private _meta: IArtifactMeta = {
		accessed: new Date(),
		created: new Date(),
		updated: new Date(),
		tags: [],
		layout: {}
	};

	/**
	 * The constructor is private.  Objects must be created with the factory
	 */
	private constructor() {}

	public absolute(): string {
		return path.join(this.root, this.path());
	}

	/**
	 * Adds a unique tag to the artifact.
	 * @param tag {string} the name of the tag to add.
	 */
	public addTag(tag: string) {
		if (this._meta.tags.indexOf(tag) === -1) {
			this._meta.tags.push(tag);
		}
	}

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
		let s: string = '';

		s += `section: '${this._section}', `;
		s += `notebook: '${this._notebook}', `;
		s += `filename: '${this._filename}', `;
		s += `type: ${this._type}, `;
		s += `loaded: ${this._loaded}, `;
		s += `dirty: ${this._dirty}, `;
		s += `accessed: ${this._meta.accessed}, `;
		s += `created: ${this._meta.created}, `;
		s += `updated: ${this._meta.updated}, `;
		s += `tags: '${this._meta.tags.join('|')}'`;

		return s;
	}

	//
	// Properties
	//

	get accessed(): Date {
		return this._meta.accessed;
	}

	set accessed(val: Date) {
		this._meta.accessed = val;
	}

	get buf(): string {
		return this._buf;
	}

	set buf(val: string) {
		this.makeDirty();
		this._buf = val;
	}

	/**
	 * Takes the current input "buf", converts it to a buffer, and returns it
	 * @returns {Buffer} a new instance of the input data as a buffer.
	 */
	get buffer(): Buffer {
		return Buffer.from(this.buf);
	}

	get created(): Date {
		return this._meta.created;
	}

	set created(val: Date) {
		this._meta.created = val;
	}

	get filename(): string {
		return this._filename;
	}

	set filename(val: string) {
		this._filename = val;
	}

	get layout() {
		return this._meta.layout;
	}

	get loaded(): boolean {
		return this._loaded;
	}

	set loaded(val: boolean) {
		this._loaded = val;
	}

	get meta(): IArtifactMeta {
		return this._meta;
	}

	set meta(val: IArtifactMeta) {
		this._meta = val;
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

	get tags(): string[] {
		return this._meta.tags;
	}

	get type(): ArtifactType {
		return this._type;
	}

	set type(val: ArtifactType) {
		this._type = val;
	}

	get updated(): Date {
		return this._meta.updated;
	}

	set updated(val: Date) {
		this._meta.updated = val;
	}
}
