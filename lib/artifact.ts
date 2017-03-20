import * as fs from 'fs-extra';
import * as _ from 'lodash';
import * as path from 'path';
import {timestamp} from 'util.timestamp';

export const enum ArtifactType {
	Unk = 0,  // 0000b - Unknown type
	S = 1,  // 0001b - Section only
	SN = 3,  // 0011b - Section and notebook
	SNA = 7   // 0111b - Section, notebook, and artifact
}

export interface IArtifactSearch {
	section?: string;
	notebook?: string;
	filename?: string;
}

export interface IArtifactOpts extends IArtifactSearch {
	root?: string;
	treeitem?: string;
	path?: string;
	type?: ArtifactType;
}

export interface IArtifactMeta {
	accessed: Date;
	created: Date;
	updated: Date;
	tags?: string[];
	layout?: any;
}

/**
 * Performs a comparison between two Artifact objects.  It uses the absolute
 * path for each artifact as the basis of the comparison.  This function is
 * used with the data structures in the util.ds objects.
 *
 * @param o1 {Artifact} the first artifact to compare.
 * @param o2 {Artifact} the second artifact to compare.
 * @returns {number} 0 if o1 & o2 are the same, 1 if o1 > o2, -1 if o1 < o2.
 */
export function artifactComparator(o1: Artifact, o2: Artifact): number {
	if (o1.absolute() === o2.absolute()) {
		return 0;
	} else if (o1.absolute() > o2.absolute()) {
		return 1;
	}

	return -1;
}

/**
 * A container class that holds the information for a single artifact within
 * the database.
 */
export class Artifact {

	/**
	 * Takes two search objects and checks if they are different.
	 * @param src {IArtifactSearch} 1st search object to check
	 * @param dst {IArtifactSearch} 2nd search object to check
	 * @returns true if they are the same, otherwise false.
	 */
	public static isDuplicateSearch(src: IArtifactSearch, dst: IArtifactSearch): boolean {
		return (
			src.section === dst.section &&
			src.notebook === dst.notebook &&
			src.filename === dst.filename
		);
	}

	/**
	 * Takes artifact search information and builds the type id
	 *
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
	 * @param [artifact] {Artifact} if an instance is passed to this factory
	 * then it is used instead of creating a new one.  Works like a copy
	 * constructor.
	 * @returns {Artifact} a newly constructed artifact object.
	 */
	public static factory(mode?: string, opts?: IArtifactOpts, artifact: Artifact = null): Artifact {
		if (artifact == null) {
			artifact = new Artifact();
		}

		let a: string[] = [];

		if (mode == null) {
			mode = 'empty';
		}

		switch (mode) {
			case 'fields':
				if (opts != null) {
					let args: IArtifactOpts = opts;

					artifact.section = args.section || '';
					artifact.notebook = args.notebook || '';
					artifact.filename = args.filename || '';

					if (Object.prototype.hasOwnProperty.call(args, 'root')) {
						artifact.root = args.root;
					}
				}
				break;

			case 'path':
				if (opts != null) {
					if (opts.hasOwnProperty('path') && opts.hasOwnProperty('root')) {
						artifact = Artifact.factory('treeitem', {
							root: opts.root,
							treeitem: opts.path.replace(opts.root, '').replace(/^[\/\\]*/, '')
						}, artifact);
					}
				}
				break;

			case 'treeitem':
				if (opts != null) {
					if (opts.hasOwnProperty('treeitem')) {
						let s: string = opts.treeitem || '';
						a = s.split(/\/|\\/);

						artifact.section = a[0] || 'Default';
						artifact.notebook = a[1] || 'Default';
						artifact.filename = a[2] || '';
					}

					if (opts.hasOwnProperty('root')) {
						artifact.root = opts.root;
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
	private constructor() {
	}

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

	public clone() {
		return _.cloneDeep(this);
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

	public isEmpty(): boolean {
		return this._section === '' && this._notebook === '' && this._filename === '';
	}

	/**
	 * Checks this artifact against a given artifact to show if they are equal
	 * @param artifact {Artifact} input artifact to check against this one
	 * @returns {boolean} true if the artifacts are the same, otherwise false.
	 */
	public isEqual(artifact: Artifact): boolean {
		return (artifactComparator(this, artifact) === 0);
	}

	public makeClean() {
		this._dirty = false;
	}

	public makeDirty() {
		this._dirty = true;
	}

	/**
	 * Takes an artifact and appends a timestamp to the last part of its path
	 * @returns {Artifact} the modified artifact with a timestamp attached to
	 * the last element of the path.
	 */
	public makeUnique(): Artifact {
		let ts: string = `.${timestamp()}`;
		if (this.type === ArtifactType.SNA) {
			this.filename += ts;
		} else if (this.type === ArtifactType.SN) {
			this.notebook += ts;
		} else if (this.type === ArtifactType.S) {
			this.section += ts;
		}

		return this;
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
