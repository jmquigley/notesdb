'use strict';

import * as assert from 'assert';
import * as path from 'path';
import {Fixture} from 'util.fixture';
import {Artifact} from '../index';
import {
	artifactComparator, ArtifactType, IArtifactOpts,
	IArtifactSearch
} from '../lib/artifact';
import {validateArtifact} from './helpers';

const pkg = require('../package.json');

describe(path.basename(__filename), () => {

	// after(() => {
	// 	debug('final cleanup: test_artifacts');
	// 	let directories = Fixture.cleanup();
	// 	directories.forEach((directory: string) => {
	// 		assert(!fs.existsSync(directory));
	// 	});
	// });

	it('Testing artifact with empty creation', () => {
		let fixture = new Fixture();
		let artifact = Artifact.factory();
		artifact.root = fixture.dir;

		validateArtifact(artifact, {
			section: '',
			notebook: '',
			filename: '',
			type: ArtifactType.Unk
		});

		artifact.created = new Date();
		artifact.accessed = new Date();
		artifact.updated = new Date();

		assert(artifact.info() === '||');
		assert(typeof artifact.toString() === 'string');

		if (pkg.debug) {
			console.log(artifact.toString());
		}

		assert(artifact.buffer instanceof Buffer);
		assert(artifact.root === fixture.dir);
		assert(artifact.path() === '.');
		assert(artifact.type === ArtifactType.Unk);
		assert(artifact.isEmpty());
		assert(artifact.accessed != null && artifact.accessed instanceof Date);
		assert(artifact.created != null && artifact.created instanceof Date);
		assert(artifact.updated != null && artifact.updated instanceof Date);
		assert(artifact.layout);
		assert(!artifact.loaded);
		artifact.loaded = true;
		assert(artifact.loaded);
		assert(artifact.tags);
		assert(artifact.tags instanceof Array);
		assert(artifact.absolute() === path.join(fixture.dir, artifact.path()));

		artifact.addTag('A');
		artifact.addTag('A');
		artifact.addTag('B');

		assert(artifact.tags instanceof Array);
		assert(artifact.tags.length === 2);
		assert(artifact.tags[0] === 'A');
		assert(artifact.tags[1] === 'B');
	});

	it('Testing artifact creation type bitmasking', () => {
		let opts: IArtifactOpts = {
			section: 'section',
			notebook: 'notebook',
			filename: 'filename'
		};
		let a7 = Artifact.factory('fields', opts);
		opts.type = ArtifactType.SNA;
		validateArtifact(a7, opts);

		opts = {
			section: 'section',
			notebook: 'notebook'
		};
		let a3 = Artifact.factory('fields', opts);
		opts.type = ArtifactType.SN;
		validateArtifact(a3, opts);

		opts = {
			section: 'section'
		};
		let a1 = Artifact.factory('fields', opts);
		opts.type = ArtifactType.S;
		validateArtifact(a1, opts);

		let a0 = Artifact.factory('empty');
		validateArtifact(a0, {
			section: '',
			notebook: '',
			filename: '',
			type: ArtifactType.Unk
		});
		assert(a0.isEmpty());

		a0 = Artifact.factory('fields', {});
		validateArtifact(a0, {
			section: '',
			notebook: '',
			filename: '',
			type: ArtifactType.Unk
		});
		assert(a0.isEmpty());
	});

	it('Testing artifact with factory fields creation', () => {
		let fixture = new Fixture();
		let artifact = Artifact.factory('fields', {
			root: fixture.dir,
			filename: 'filename',
			notebook: 'notebook',
			section: 'section'
		});

		validateArtifact(artifact, {
			section: 'section',
			notebook: 'notebook',
			filename: 'filename',
			type: ArtifactType.SNA
		});

		assert(artifact.root === fixture.dir);
		assert(artifact.path() === `section${path.sep}notebook${path.sep}filename`);
		assert(artifact.hasSection());
		assert(artifact.hasNotebook());
		assert(artifact.hasFilename());
	});

	it('Testing artifact with factory path creation', () => {
		let fixture = new Fixture('simple-db');
		let artifact = Artifact.factory('path', {
			root: path.join(fixture.dir, 'sampledb'),
			path: path.join(fixture.dir, 'sampledb', 'Default', 'Default', 'test1.txt')
		});

		validateArtifact(artifact, {
			section: 'Default',
			notebook: 'Default',
			filename: 'test1.txt',
			type: ArtifactType.SNA
		});
	});

	it('Testing artifact with factory treeitem creation', () => {
		let fixture = new Fixture();
		let artifact = Artifact.factory('treeitem', {
			treeitem: `section${path.sep}notebook${path.sep}filename`,
			root: fixture.dir
		});

		validateArtifact(artifact, {
			section: 'section',
			notebook: 'notebook',
			filename: 'filename',
			type: ArtifactType.SNA
		});

		assert(artifact.root === fixture.dir);
	});

	it('Testing artifact with factory treeitem section only creation', () => {
		let fixture = new Fixture();
		let artifact = Artifact.factory('treeitem', {
			treeitem: 'section',
			root: fixture.dir
		});

		validateArtifact(artifact, {
			section: 'section',
			notebook: 'Default',
			type: ArtifactType.SN
		});

		assert(artifact.root === fixture.dir);
	});

	it('Testing artifact with factory treeitem section & notebook only creation', () => {
		let fixture = new Fixture();
		let artifact = Artifact.factory('treeitem', {
			treeitem: `section${path.sep}notebook${path.sep}`,
			root: fixture.dir
		});

		validateArtifact(artifact, {
			section: 'section',
			notebook: 'notebook',
			type: ArtifactType.SN
		});
	});

	it('Testing artifact with factory treeitem too many items on creation', () => {
		let fixture = new Fixture();
		let artifact = Artifact.factory('treeitem', {
			treeitem: `section${path.sep}notebook${path.sep}filename${path.sep}blah1${path.sep}blah2`,
			root: fixture.dir
		});

		validateArtifact(artifact, {
			section: 'section',
			notebook: 'notebook',
			filename: 'filename',
			type: ArtifactType.SNA
		});
	});

	it('Test with an unknown mode sent to factory', () => {
		let artifact = Artifact.factory('blahblahblah');

		validateArtifact(artifact, {});
	});

	it('Testing the dirty flag', () => {
		let artifact = Artifact.factory('fields', {
			filename: 'filename',
			notebook: 'notebook',
			section: 'section'
		});

		validateArtifact(artifact, {
			section: 'section',
			notebook: 'notebook',
			filename: 'filename',
			type: ArtifactType.SNA
		});

		assert(!artifact.isDirty());
		artifact.makeDirty();
		assert(artifact.isDirty());
		artifact.makeClean();
		assert(!artifact.isDirty());
	});

	it('Testing has functions', () => {
		let artifact = Artifact.factory();

		validateArtifact(artifact, {});

		assert(!artifact.hasSection());
		assert(!artifact.hasNotebook());
		assert(!artifact.hasFilename());
	});

	it('Test bad root on artifact (negative test)', () => {
		let artifact = Artifact.factory();

		validateArtifact(artifact, {});

		let root = 'aksjdflkasjdflskjdf';
		try {
			artifact.root = root;
			assert(false, 'Bad root should not pass');
		} catch (err) {
			assert.equal(err.message, `Invalid root path for artifact: ${root}`);
		}
	});

	it('Test artifact data append', () => {
		let artifact = Artifact.factory();

		validateArtifact(artifact, {});

		assert(artifact && artifact instanceof Artifact);
		assert.equal(artifact.buf, '');

		artifact.buf += 'Foo';
		assert.equal(artifact.buf, 'Foo');

		artifact.buf += 'Bar';
		assert.equal(artifact.buf, 'FooBar');
	});

	it('Test comparator function', () => {
		let a1 = Artifact.factory('fields', {
			filename: 'a',
			notebook: 'a',
			section: 'a'
		});

		let a2 = Artifact.factory('fields', {
			filename: 'b',
			notebook: 'b',
			section: 'b'
		});

		let a3 = Artifact.factory('fields', {
			filename: 'c',
			notebook: 'c',
			section: 'c'
		});

		assert.equal(artifactComparator(a1, a1), 0);
		assert.equal(artifactComparator(a2, a1), 1);
		assert.equal(artifactComparator(a1, a3), -1);
	});

	it('Test the isEqual function', () => {
		let s1: IArtifactSearch = {
			filename: 'a',
			notebook: 'a',
			section: 'a'
		};
		let a1 = Artifact.factory('fields', s1);

		let s2: IArtifactSearch = {
			filename: 'b',
			notebook: 'b',
			section: 'b'
		};
		let a2 = Artifact.factory('fields', s2);

		assert(a1.isEqual(a1));
		assert(!a1.isEqual(a2));

		assert(Artifact.isDuplicateSearch(s1, s1));
		assert(!Artifact.isDuplicateSearch(s1, s2));
	});
});
