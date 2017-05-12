'use strict';

import test from 'ava';
import * as fs from 'fs-extra';
import * as path from 'path';
import {Fixture} from 'util.fixture';
import {join} from 'util.join';
import {failure} from 'util.toolbox';
import {Binder, BinderManager} from '../index';
import {cleanup} from './helpers';

test.after.always.cb(t => {
	cleanup(path.basename(__filename), t);
});

test('Test the creation of the BinderManager class', t => {
	const fixture = new Fixture();
	const manager = new BinderManager(fixture.dir, {
		defaultDirectory: join(fixture.dir)
	});

	t.truthy(manager);
	t.is(manager.bindersDirectory, join(fixture.dir, 'binders'));
	t.true(fs.existsSync(join(fixture.dir, 'binders', 'default')));
	t.true(fs.existsSync(join(fixture.dir, 'binders', 'default', 'config.json')));

	const adb: Binder = manager.get('default');
	t.truthy(adb);
	t.true(adb instanceof Binder);

	const json = JSON.parse(fixture.read('binders/default/config.json'));
	t.is(json.binderName, 'default');
	t.is(json.configFile, join(fixture.dir, 'binders', 'default', 'config.json'));
});

test('Test the creation of build manager with existing default', t => {
	const fixture = new Fixture('simple-manager');
	const manager = new BinderManager(fixture.dir, {
		defaultDirectory: join(fixture.dir)
	});

	t.truthy(manager);
	t.is(manager.bindersDirectory, join(fixture.dir, 'binders'));
	t.true(fs.existsSync(join(fixture.dir, 'binders', 'default')));
	t.true(fs.existsSync(join(fixture.dir, 'binders', 'default', 'config.json')));

	let adb: Binder = manager.get('default');
	t.truthy(adb);
	t.true(adb instanceof Binder);

	adb = manager.get('sampledb');
	t.truthy(adb);
	t.true(adb instanceof Binder);
});

test('Test using the add function on a binder that already exists (negative test)', t => {
	const fixture = new Fixture('simple-manager');
	const manager = new BinderManager(fixture.dir, {
		defaultDirectory: join(fixture.dir)
	});

	t.truthy(manager);
	t.is(manager.bindersDirectory, join(fixture.dir, 'binders'));
	t.true(fs.existsSync(join(fixture.dir, 'binders', 'default')));
	t.true(fs.existsSync(join(fixture.dir, 'binders', 'default', 'config.json')));

	t.is(manager.add('default', join(fixture.dir, 'default')), failure);
});
