'use strict';

import test from 'ava';
import * as fs from 'fs-extra';
import * as path from 'path';
import {Fixture} from 'util.fixture';
import {join} from 'util.join';
import {failure} from 'util.toolbox';
import {Binder, BinderManager} from '../index';
import {cleanup, validateManager} from './helpers';

test.after.always.cb(t => {
	cleanup(path.basename(__filename), t);
});

test('Test the creation of the BinderManager class', t => {
	const fixture = new Fixture();
	const manager = new BinderManager(fixture.dir, {
		defaultDirectory: join(fixture.dir)
	});

	validateManager(t, manager, fixture);

	const json = JSON.parse(fixture.read('binders/default/config.json'));
	t.is(json.binderName, 'default');
	t.is(json.configFile, join(fixture.dir, 'binders', 'default', 'config.json'));
});

test('Test the creation of build manager with existing default', t => {
	const fixture = new Fixture('simple-manager');
	const manager = new BinderManager(fixture.dir, {
		defaultDirectory: join(fixture.dir)
	});

	validateManager(t, manager, fixture);

	const adb = manager.get('sampledb');
	t.truthy(adb);
	t.true(adb instanceof Binder);

	const s: string = manager.info();
	t.truthy(s);
});

test('Test using the add function on a binder that already exists (negative test)', t => {
	const fixture = new Fixture('simple-manager');
	const manager = new BinderManager(fixture.dir, {
		defaultDirectory: join(fixture.dir)
	});

	validateManager(t, manager, fixture);

	t.is(manager.add('default', join(fixture.dir, 'default')), failure);
});

test('Test retrival of the list from the manager', t => {
	const fixture = new Fixture('simple-manager');
	const manager = new BinderManager(fixture.dir, {
		defaultDirectory: join(fixture.dir)
	});

	validateManager(t, manager, fixture);

	const l = manager.list();

	t.truthy(l);
	t.deepEqual(l, ['default', 'sampledb']);
});

test('Test the removal of a binder to the trash', t => {
	const fixture = new Fixture('simple-manager');
	const manager = new BinderManager(fixture.dir, {
		defaultDirectory: join(fixture.dir)
	});

	validateManager(t, manager, fixture);

	const rem = manager.remove('sampledb');
	t.false(fs.existsSync(join(fixture.dir, 'binders', 'sampledb')));
	t.true(fs.existsSync(rem));
});

test('Try to remove a non-existent binder', t => {
	const fixture = new Fixture('simple-manager');
	const manager = new BinderManager(fixture.dir, {
		defaultDirectory: join(fixture.dir)
	});

	validateManager(t, manager, fixture);

	const rem = manager.remove('blahblahblah');
	t.is(rem, '');
});
