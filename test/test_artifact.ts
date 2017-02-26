'use strict';

import {test} from 'ava';
import * as fs from 'fs-extra';
import * as path from 'path';
import {Fixture} from 'util.fixture';
import {Artifact} from '../index';
import {ArtifactType, IArtifactOpts} from '../lib/artifact';
import {validateArtifact} from './helpers';

const pkg = require('../package.json');

test.after.always((t: any) => {
	console.log('final cleanup: test_artifacts');
	let directories = Fixture.cleanup();
	directories.forEach((directory: string) => {
		t.false(fs.existsSync(directory));
	});
});

test.cb('Testing artifact with empty creation', (t: any) => {
	let fixture = new Fixture();
	let artifact = Artifact.factory();
	artifact.root = fixture.dir;

	validateArtifact(artifact, t, {
		section: '',
		notebook:'',
		filename: '',
		type: ArtifactType.Unk,
	});

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
	t.end();
});

test.cb('Testing artifact creation type bitmasking', (t: any) => {

	let opts: IArtifactOpts = {
		section: 'section',
		notebook: 'notebook',
		filename: 'filename'
	};
	let a7 = Artifact.factory('fields', opts);
	opts.type = ArtifactType.SNA;
	validateArtifact(a7, t, opts);

	opts = {
		section: 'section',
		notebook: 'notebook'
	};
	let a3 = Artifact.factory('fields', opts);
	opts.type = ArtifactType.SN;
	validateArtifact(a3, t, opts);

	opts = {
		section: 'section'
	};
	let a1 = Artifact.factory('fields', opts);
	opts.type = ArtifactType.S;
	validateArtifact(a1, t, opts);

	let a0 = Artifact.factory('empty');
	validateArtifact(a0, t, {
		section: '',
		notebook: '',
		filename: '',
		type: ArtifactType.Unk
	});
	t.true(a0.isEmtpy());

	a0 = Artifact.factory('fields', {});
	validateArtifact(a0, t, {
		section: '',
		notebook: '',
		filename: '',
		type: ArtifactType.Unk
	});
	t.true(a0.isEmtpy());
	t.end();
});

test.cb('Testing artifact with factory fields creation', (t: any) => {
	let fixture = new Fixture();
	let artifact = Artifact.factory('fields', {
		root: fixture.dir,
		filename: 'filename',
		notebook: 'notebook',
		section: 'section'
	});

	validateArtifact(artifact, t, {
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
	t.end();
});

test.cb('Testing artifact with factory path creation', (t: any) => {
	let fixture = new Fixture('simple-db');
	let artifact = Artifact.factory('path', {
		root: path.join(fixture.dir, 'sampledb'),
		path: path.join(fixture.dir, 'sampledb', 'Default', 'Default', 'test1.txt')
	});

	validateArtifact(artifact, t, {
		section: 'Default',
		notebook: 'Default',
		filename: 'test1.txt',
		type: ArtifactType.SNA
	});

	t.end();
});

test.cb('Testing artifact with factory treeitem creation', (t: any) => {
	let fixture = new Fixture();
	let artifact = Artifact.factory('treeitem', {
		treeitem: `section${path.sep}notebook${path.sep}filename`,
		root: fixture.dir
	});

	validateArtifact(artifact, t, {
		section: 'section',
		notebook: 'notebook',
		filename: 'filename',
		type: ArtifactType.SNA
	});

	t.is(artifact.root, fixture.dir);
	t.end();
});

test.cb('Testing artifact with factory treeitem section only creation', (t: any) => {
	let fixture = new Fixture();
	let artifact = Artifact.factory('treeitem', {
		treeitem: 'section',
		root: fixture.dir
	});

	validateArtifact(artifact, t, {
		section: 'section',
		notebook: 'Default',
		type: ArtifactType.SN
	});

	t.is(artifact.root, fixture.dir);
	t.end();
});

test.cb('Testing artifact with factory treeitem section & notebook only creation', (t: any) => {
	let fixture = new Fixture();
	let artifact = Artifact.factory('treeitem', {
		treeitem: `section${path.sep}notebook${path.sep}`,
		root: fixture.dir
	});

	validateArtifact(artifact, t, {
		section: 'section',
		notebook: 'notebook',
		type: ArtifactType.SN
	});
	t.end()
});

test.cb('Testing artifact with factory treeitem too many items on creation', (t: any) => {
	let fixture = new Fixture();
	let artifact = Artifact.factory('treeitem', {
		treeitem: `section${path.sep}notebook${path.sep}filename${path.sep}blah1${path.sep}blah2`,
		root: fixture.dir
	});

	validateArtifact(artifact, t, {
		section: 'section',
		notebook: 'notebook',
		filename: 'filename',
		type: ArtifactType.SNA
	});
	t.end()
});

test.cb('Test with an unknown mode sent to factory', (t: any) => {
	let artifact = Artifact.factory('blahblahblah');

	validateArtifact(artifact, t, {});
	t.end();
});

test.cb('Testing the dirty flag', (t: any) => {
	let artifact = Artifact.factory('fields', {
		filename: 'filename',
		notebook: 'notebook',
		section: 'section'
	});

	validateArtifact(artifact, t, {
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
	t.end();
});

test.cb('Testing has functions', (t: any) => {
	let artifact = Artifact.factory();

	validateArtifact(artifact, t, {});

	t.false(artifact.hasSection());
	t.false(artifact.hasNotebook());
	t.false(artifact.hasFilename());
	t.end();
});

test.cb('Test bad root on artifact (negative test)', (t: any) => {
	let artifact = Artifact.factory();

	validateArtifact(artifact, t, {});

	let root = 'aksjdflkasjdflskjdf';
	try {
		artifact.root = root;
		t.fail()
	} catch (err) {
		t.is(err.message, `Invalid root path for artifact: ${root}`);
		t.pass(err.message);
	}

	t.end();
});

test.cb('Test artifact data append', (t: any) => {
	let artifact = Artifact.factory();

	validateArtifact(artifact, t, {});

	t.true(artifact && artifact instanceof Artifact);
	t.is(artifact.buf, '');

	artifact.buf += 'Foo';
	t.is(artifact.buf, 'Foo');

	artifact.buf += 'Bar';
	t.is(artifact.buf, 'FooBar');

	t.end();
});
