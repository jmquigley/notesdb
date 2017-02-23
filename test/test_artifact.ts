'use strict';

import {test} from 'ava';
import * as fs from 'fs-extra';
import * as path from 'path';
import {Fixture} from 'util.fixture';
import {Artifact} from '../index';
import {ArtifactType} from '../lib/artifact';
import {validateArtifact} from './helpers';

const pkg = require('../package.json');

test.after.always((t: any) => {
	console.log('final cleanup: test_artifacts');
	let directories = Fixture.cleanup();
	directories.forEach((directory: string) => {
		t.false(fs.existsSync(directory));
	});
});

test('Testing artifact with empty creation', (t: any) => {
	let fixture = new Fixture();
	let artifact = Artifact.factory();
	artifact.root = fixture.dir;

	validateArtifact(artifact, '', '', '', t);

	artifact.created = new Date();
	artifact.accessed = new Date();
	artifact.updated = new Date();

	t.is(artifact.info(), '||');
	t.true(typeof artifact.toString() === 'string');

	if (pkg.debug) {
		console.log(artifact.toString());
	}

	t.true(artifact.buffer instanceof Buffer);
	t.is(artifact.root, fixture.dir);
	t.is(artifact.path(), '.');
	t.is(artifact.type, ArtifactType.Unk);
	t.true(artifact.isEmtpy());
	t.true(artifact.accessed != null && artifact.accessed instanceof Date);
	t.true(artifact.created != null && artifact.created instanceof Date);
	t.true(artifact.updated != null && artifact.updated instanceof Date);
	t.truthy(artifact.layout);
	t.false(artifact.loaded);
	artifact.loaded = true;
	t.true(artifact.loaded);
	t.truthy(artifact.tags);
	t.true(artifact.tags instanceof Array);
	t.is(artifact.absolute(), path.join(fixture.dir, artifact.path()));

	artifact.addTag('A');
	artifact.addTag('A');
	artifact.addTag('B');

	t.true(artifact.tags instanceof Array);
	t.is(artifact.tags.length, 2);
	t.true(artifact.tags[0] === 'A');
	t.true(artifact.tags[1] === 'B');
});

test('Testing artifact creation type bitmasking', (t: any) => {
	let a7 = Artifact.factory('fields', {
		section: 'section',
		notebook: 'notebook',
		filename: 'filename'
	});
	validateArtifact(a7, 'section', 'notebook', 'filename', t);
	t.is(a7.type, ArtifactType.SNA);

	let a3 = Artifact.factory('fields', {
		section: 'section',
		notebook: 'notebook'
	});
	validateArtifact(a3, 'section', 'notebook', '', t);
	t.is(a3.type, ArtifactType.SN);

	let a1 = Artifact.factory('fields', {
		section: 'section'
	});
	validateArtifact(a1, 'section', '', '', t);
	t.is(a1.type, ArtifactType.S);

	let a0 = Artifact.factory('empty');
	validateArtifact(a0, '', '', '', t);
	t.is(a0.type, ArtifactType.Unk);
	t.true(a0.isEmtpy());
});

test('Testing artifact with factory all creation', (t: any) => {
	let fixture = new Fixture();
	let artifact = Artifact.factory('fields', {
		root: fixture.dir,
		filename: 'filename',
		notebook: 'notebook',
		section: 'section'
	});

	validateArtifact(artifact, 'section', 'notebook', 'filename', t);

	t.is(artifact.root, fixture.dir);
	t.is(artifact.path(), 'section/notebook/filename');
	t.true(artifact.hasSection());
	t.true(artifact.hasNotebook());
	t.true(artifact.hasFilename());
});

test('Testing artifact with factory treeitem creation', (t: any) => {
	let fixture = new Fixture();
	let artifact = Artifact.factory('treeitem', {
		treeitem: `section${path.sep}notebook${path.sep}filename`,
		root: fixture.dir
	});

	validateArtifact(artifact, 'section', 'notebook', 'filename', t);

	t.is(artifact.root, fixture.dir);
});

test('Testing artifact with factory treeitem section only creation', (t: any) => {
	let fixture = new Fixture();
	let artifact = Artifact.factory('treeitem', {
		treeitem: 'section',
		root: fixture.dir
	});

	validateArtifact(artifact, 'section', 'Default', '', t);

	t.is(artifact.root, fixture.dir);
});

test('Testing artifact with factory treeitem section & notebook only creation', (t: any) => {
	let fixture = new Fixture();
	let artifact = Artifact.factory('treeitem', {
		treeitem: `section${path.sep}notebook${path.sep}`,
		root: fixture.dir
	});

	validateArtifact(artifact, 'section', 'notebook', '', t);
});

test('Testing artifact with factory treeitem too many items on creation', (t: any) => {
	let fixture = new Fixture();
	let artifact = Artifact.factory('treeitem', {
		treeitem: `section${path.sep}notebook${path.sep}filename${path.sep}blah1${path.sep}blah2`,
		root: fixture.dir
	});

	validateArtifact(artifact, 'section', 'notebook', 'filename', t);
});

test('Test with an unknown mode sent to factory', (t: any) => {
	let artifact = Artifact.factory('blahblahblah');

	validateArtifact(artifact, '', '', '', t);
});

test('Testing the dirty flag', (t: any) => {
	let artifact = Artifact.factory('fields', {
		filename: 'filename',
		notebook: 'notebook',
		section: 'section'
	});

	t.false(artifact.isDirty());
	artifact.makeDirty();
	t.true(artifact.isDirty());
	artifact.makeClean();
	t.false(artifact.isDirty());
});

test('Testing has functions', (t: any) => {
	let artifact = Artifact.factory();
	t.false(artifact.hasSection());
	t.false(artifact.hasNotebook());
	t.false(artifact.hasFilename());
});

test('Test bad root on artifact (negative test)', (t: any) => {
	let artifact = Artifact.factory();
	let root = 'aksjdflkasjdflskjdf';
	try {
		artifact.root = root;
		t.fail()
	} catch (err) {
		t.is(err.message, `Invalid root path for artifact: ${root}`);
		t.pass(err.message);
	}
});

test('Test artifact data append', (t: any) => {
	let artifact = Artifact.factory();

	t.true(artifact && artifact instanceof Artifact);
	t.is(artifact.buf, '');

	artifact.buf += 'Foo';
	t.is(artifact.buf, 'Foo');

	artifact.buf += 'Bar';
	t.is(artifact.buf, 'FooBar');
});
