'use strict';

import test from 'ava';
import * as path from 'path';
import {Fixture} from 'util.fixture';
import {join} from 'util.join';
import {Artifact} from '../index';
import {
	artifactComparator,
	ArtifactOpts,
	ArtifactSearch,
	ArtifactType
} from '../lib/artifact';
import {cleanup, validateArtifact} from './helpers';

const pkg = require('../package.json');

test.after.always(async t => {
	await cleanup(path.basename(__filename), t);
});

test('Testing artifact with empty creation', t => {
	const fixture = new Fixture();
	const artifact = Artifact.factory();
	artifact.root = fixture.dir;

	validateArtifact(t, artifact, {
		section: '',
		notebook: '',
		filename: '',
		type: ArtifactType.Unk
	});

	artifact.created = new Date();
	artifact.accessed = new Date();
	artifact.updated = new Date();

	t.is(artifact.info(), '||');
	t.is(typeof artifact.toString(), 'string');

	if (pkg.debug) {
		console.log(artifact.toString());
	}

	t.truthy(artifact.buffer instanceof Buffer);
	t.is(artifact.root, fixture.dir);
	t.is(artifact.path(), '');
	t.is(artifact.type, ArtifactType.Unk);
	t.true(artifact.isEmpty());
	t.true(artifact.accessed != null && artifact.accessed instanceof Date);
	t.true(artifact.created != null && artifact.created instanceof Date);
	t.true(artifact.updated != null && artifact.updated instanceof Date);
	t.truthy(artifact.layout);
	t.true(!artifact.loaded);
	artifact.loaded = true;
	t.true(artifact.loaded);
	t.truthy(artifact.tags);
	t.truthy(artifact.tags instanceof Array);
	t.is(artifact.absolute(), join(fixture.dir, artifact.path()));

	artifact.addTag('A');
	artifact.addTag('A');
	artifact.addTag('B');

	t.truthy(artifact.tags instanceof Array);
	t.is(artifact.tags.length, 2);
	t.is(artifact.tags[0], 'A');
	t.is(artifact.tags[1], 'B');
});

test('Testing artifact creation type bitmasking', t => {
	let opts: ArtifactOpts = {
		section: 'section',
		notebook: 'notebook',
		filename: 'filename'
	};
	const a7 = Artifact.factory('fields', opts);
	opts.type = ArtifactType.SNA;
	validateArtifact(t, a7, opts);

	opts = {
		section: 'section',
		notebook: 'notebook'
	};
	const a3 = Artifact.factory('fields', opts);
	opts.type = ArtifactType.SN;
	validateArtifact(t, a3, opts);

	opts = {
		section: 'section'
	};
	const a1 = Artifact.factory('fields', opts);
	opts.type = ArtifactType.S;
	validateArtifact(t, a1, opts);

	let a0 = Artifact.factory('empty');
	validateArtifact(t, a0, {
		section: '',
		notebook: '',
		filename: '',
		type: ArtifactType.Unk
	});
	t.true(a0.isEmpty());

	a0 = Artifact.factory('fields', {});
	validateArtifact(t, a0, {
		section: '',
		notebook: '',
		filename: '',
		type: ArtifactType.Unk
	});
	t.true(a0.isEmpty());
});

test('Testing artifact with factory fields creation', t => {
	const fixture = new Fixture();
	const artifact = Artifact.factory('fields', {
		root: fixture.dir,
		filename: 'filename',
		notebook: 'notebook',
		section: 'section'
	});

	validateArtifact(t, artifact, {
		section: 'section',
		notebook: 'notebook',
		filename: 'filename',
		type: ArtifactType.SNA
	});

	t.is(artifact.root, fixture.dir);
	t.is(artifact.path(), 'section/notebook/filename');
	t.true(artifact.hasSection());
	t.true(artifact.hasNotebook());
	t.true(artifact.hasFilename());
});

test('Testing artifact with factory path creation', t => {
	const fixture = new Fixture('simple-db');
	const artifact = Artifact.factory('path', {
		root: join(fixture.dir, 'sampledb'),
		path: join(fixture.dir, 'sampledb', 'Default', 'Default', 'test1.txt')
	});

	validateArtifact(t, artifact, {
		section: 'Default',
		notebook: 'Default',
		filename: 'test1.txt',
		type: ArtifactType.SNA
	});

	t.pass();
});

test('Testing artifact with factory treeitem creation', t => {
	const fixture = new Fixture();
	const artifact = Artifact.factory('treeitem', {
		treeitem: 'section/notebook/filename',
		root: fixture.dir
	});

	validateArtifact(t, artifact, {
		section: 'section',
		notebook: 'notebook',
		filename: 'filename',
		type: ArtifactType.SNA
	});

	t.is(artifact.root, fixture.dir);
});

test('Testing artifact with factory treeitem section only creation', t => {
	const fixture = new Fixture();
	const artifact = Artifact.factory('treeitem', {
		treeitem: 'section',
		root: fixture.dir
	});

	validateArtifact(t, artifact, {
		section: 'section',
		notebook: 'Default',
		type: ArtifactType.SN
	});

	t.is(artifact.root, fixture.dir);
});

test('Testing artifact with factory treeitem section & notebook only creation', t => {
	const fixture = new Fixture();
	const artifact = Artifact.factory('treeitem', {
		treeitem: 'section/notebook/',
		root: fixture.dir
	});

	validateArtifact(t, artifact, {
		section: 'section',
		notebook: 'notebook',
		type: ArtifactType.SN
	});

	t.pass();
});

test('Testing artifact with factory treeitem too many items on creation', t => {
	const fixture = new Fixture();
	const artifact = Artifact.factory('treeitem', {
		treeitem: 'section/notebook/filename/blah1/blah2',
		root: fixture.dir
	});

	validateArtifact(t, artifact, {
		section: 'section',
		notebook: 'notebook',
		filename: 'filename',
		type: ArtifactType.SNA
	});

	t.pass();
});

test('Test with an unknown mode sent to factory', t => {
	const artifact = Artifact.factory('blahblahblah');
	validateArtifact(t, artifact, {});

	t.pass();
});

test('Testing the dirty flag', t => {
	const artifact = Artifact.factory('fields', {
		filename: 'filename',
		notebook: 'notebook',
		section: 'section'
	});

	validateArtifact(t, artifact, {
		section: 'section',
		notebook: 'notebook',
		filename: 'filename',
		type: ArtifactType.SNA
	});

	t.false(artifact.isDirty());
	artifact.makeDirty();
	t.true(artifact.isDirty());
	artifact.makeClean();
	t.false(artifact.isDirty());
});

test('Testing has functions', t => {
	const artifact = Artifact.factory();

	validateArtifact(t, artifact, {});

	t.false(artifact.hasSection());
	t.false(artifact.hasNotebook());
	t.false(artifact.hasFilename());
});

test('Test bad root on artifact (negative test)', t => {
	const artifact = Artifact.factory();

	validateArtifact(t, artifact, {});

	const root = 'aksjdflkasjdflskjdf';
	try {
		artifact.root = root;
		t.fail('Bad root should not pass');
	} catch (err) {
		t.is(err.message, `Invalid root path for artifact: ${root}`);
	}
});

test('Test artifact data append', t => {
	const artifact = Artifact.factory();

	validateArtifact(t, artifact, {});

	t.truthy(artifact && artifact instanceof Artifact);
	t.is(artifact.buf, '');

	artifact.buf += 'Foo';
	t.is(artifact.buf, 'Foo');

	artifact.buf += 'Bar';
	t.is(artifact.buf, 'FooBar');
});

test('Test comparator function', t => {
	const a1 = Artifact.factory('fields', {
		filename: 'a',
		notebook: 'a',
		section: 'a'
	});

	const a2 = Artifact.factory('fields', {
		filename: 'b',
		notebook: 'b',
		section: 'b'
	});

	const a3 = Artifact.factory('fields', {
		filename: 'c',
		notebook: 'c',
		section: 'c'
	});

	t.is(artifactComparator(a1, a1), 0);
	t.is(artifactComparator(a2, a1), 1);
	t.is(artifactComparator(a1, a3), -1);
});

test('Test the isEqual function', t => {
	const s1: ArtifactSearch = {
		filename: 'a',
		notebook: 'a',
		section: 'a'
	};
	const a1 = Artifact.factory('fields', s1);

	const s2: ArtifactSearch = {
		filename: 'b',
		notebook: 'b',
		section: 'b'
	};
	const a2 = Artifact.factory('fields', s2);

	t.true(a1.isEqual(a1));
	t.false(a1.isEqual(a2));

	t.true(Artifact.isDuplicateSearch(s1, s1));
	t.false(Artifact.isDuplicateSearch(s1, s2));
});
