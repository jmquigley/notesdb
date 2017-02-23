# notesdb [![Build Status](https://travis-ci.org/jmquigley/notesdb.svg?branch=master)](https://travis-ci.org/jmquigley/notesdb) [![tslint code style](https://img.shields.io/badge/code_style-TSlint-5ed9c7.svg)](https://palantir.github.io/tslint/) [![NPM](https://img.shields.io/npm/v/notesdb.svg)](https://www.npmjs.com/package/notesdb) [![Coverage Status](https://coveralls.io/repos/github/jmquigley/notesdb/badge.svg?branch=master)](https://coveralls.io/github/jmquigley/notesdb?branch=master)

> A text file notes database

The text "database" is just a data structure (schema) and a set of functions to manipulate a structured directory.  The "database" is referred to as a binder.  The binder contains sections.  Each of the sections contain notebooks.  Each notebook contains artifacts (files).  The general structure of the binder is:
 
      {binder}/
          {section}/
              {notebook 1}/
                  - {artifact 1}
                  - {artifact 2}
                  - {artifact N}
              {notebook 2}/
                  - {artifact 1}
                  - {artifact 2}
                  - {artifact N}
           {section N}/
               ...
 
 The main component is the artifact.  These are the text files.  The other items in the structure above are basic file directory structures.  Sections and notebooks are just organizing constructs (directories).

#### Features

- Promised based public API
- Automatic timed save of documents
- Trashcan


## Installation

To install as a global package and cli:
```
$ npm install --global notesdb
```

To install as an application dependency with cli:
```
$ npm install --save-dev notesdb
```


## Usage
The public api contains the following functions:

- `add()`
- `create()`
- `emptyTrash()`
- `find()`
- `get()`
- `hasArtifact()`
- `hasNotebook()`
- `hasSection()`
- `notebooks()`
- `reload()`
- `remove()`
- `restore()`
- `save()`
- `saveArtifact()`
- `sections()`
- `shutdown()`
- `toString()`

#### Creating an Instance
To construct a new instance:

```javascript
const NotesDB = require('notesdb').NotesDB;

let adb = new NotesDB();
```

Loads a default instance of the schema.  This example contains no configuration options.  It will use the default configuration directory of `~/.notesdb`.  The configuration file for this instance is saved in `~/.notesdb/config.json`.  The log file for the database is saved within this directory in `~/notesdb/notesdb.log`.  The default name of the database is `adb` (the name of the binder) and is saved in `~/.notesdb/adb`.  This is where all sections, notebooks, and artifacts will be saved.

An instance can be created with a new set of defaults:

```javascript
const NotesDB = require('notesdb').NotesDB;

let adb = new NotesDB({
	binderName: 'sampledb',
	root: '~/mydb'
});
```

This will create a new binder with the name `sampledb`.  It also changes where the configuration will be saved *root* option.  This is the default location where the schema will be stored.  If the only the root is specified, then the configuration is also located in this directory.  This database is saved in `~/mydb/sampledb`.  The configuration and the database can be separated:

```javascript
const NotesDB = require('notesdb').NotesDB;

let adb = new NotesDB({
	binderName: 'sampledb',
	configRoot: '~/mydbconfig',
	root: '~/mydb'
});
```

This will create the database in `~/mydb/sampledb` and the configuration/logs are stored in `~/mydbconfig`.

#### Creating Sections
Once an instance is created sections can be added.  There are two ways to do this.  The `create()` or `add`.  Using the create method:

```javascript
const NotesDB = require('notesdb').NotesDB;

let adb = new NotesDB();
adb.create(['Test1', 'Test2'])
	.then((adb: NotesDB) => {
		let sections = adb.sections();
		sections.forEach((section: string) => {
			console.log(` ~> ${section}`);
		});

		return adb;
	})
	.catch((err: string) => {
		console.error(err);
	});
```

This will create two new sections within the schema named `Test1` and `Test2`.  It will also contain `Default` and `Trash`.  Sections can also be created through the `add` method.  This method uses an `Artifact` object during creation.

```javascript
const Artifact = require('artifact').Artifact;
const NotesDB = require('notesdb').NotesDB;

let adb = new NotesDB();
adb.add(Artifact.factory('all', {section: 'Test1'}))
	.then((adb: NotesDB) => {
		let sections = adb.sections();
		sections.forEach((section: string) => {
			console.log(` ~> ${section}`);
		});

		return adb;
	})
	.catch((err: string) => {
		console.error(err);
	});
```

#### Creating Notebooks
A notebook is created with the `add` method.

```javascript
const Artifact = require('artifact').Artifact;
const NotesDB = require('notesdb').NotesDB;

let adb = new NotesDB();
adb.add(Artifact.factory('all', {section: 'Test1', notebook: 'MyNotebook'}))
	.then((artifact: Artifact) => {
		console.log(artifact.toString());
		let notebooks = adb.notebooks();
		notebooks.forEach((notebook: string) => {
			console.log(` ~> ${notebook}`);
		});

		return adb;
	})
	.catch((err: string) => {
		console.error(err);
	});
```

This will create a section named `Test1` (if it doesn't exist) and a notebook within that section named `MyNotebook`.

#### Creating Artifacts
An artifact is the basic document within the notebook.  These are always text files.  That are created with the `add` method:

```javascript
const Artifact = require('artifact').Artifact;
const NotesDB = require('notesdb').NotesDB;

let adb = new NotesDB();
adb.add({
	section: 'Test1', 
	notebook: 'MyNotebook', 
	filename: 'myfile.txt'
	})
	.then((artifact: Artifact) => {
		console.log(artifact.toString());
	})
	.catch((err: string) => {
		console.error(err);
	});
```

#### Retrieving Artifacts
Artifacts are placed into the system by adding them (as above) or when an instance is created (the existing artifacts are loaded automatically).  The artifacts are then retrieved from the system using the `get` method.  When retrieving an artifact one must use *section*, *notebook*, and *filename* to retrieve it:

```javascript
const Artifact = require('artifact').Artifact;
const NotesDB = require('notesdb').NotesDB;

let adb = new NotesDB();
adb.get({
	section: 'Default', 
	notebook: 'Default', 
	filename: 'test1.txt'
    })
	.then((artifact: Artifact) => {
		// do something with the artifact
	})
	.catch((err: string) => {
		console.error(err);
	});
```

#### Finding Artifacts
One can also retrieve artifacts using the `find` method.  This will perform a regex text search, using JavaScript regex, using all artifacts that are in the system.  It will return an array of artifacts that contain the search string.

```javascript
const Artifact = require('artifact').Artifact;
const NotesDB = require('notesdb').NotesDB;

let adb = new NotesDB();
adb.find('#1')
	.then((artifacts: Array<Artifact>) => {
		artifacts.forEach((artifact: Artifact) => {
			console.log(artifact.absolute());
		});
	})
	.catch((err: string) => {
		t.fail(`${t.title}: ${err}`);
	});
```

This call would find all artifacts that contain the string `#1` and return an array.

#### Removing/Restoring Artifacts
Artifacts are not removed from the system directly.  They are first moved to a special `Trash` folder within the notebook.  An artifact is removed with the `remove` method.  A removed artifact can be recovered from the trash using the `restore` method:

```javascript
const NotesDB = require('notesdb').NotesDB;

let adb = new NotesDB();
let lookup = {
	section: 'Test2',
	notebook: 'Default',
	filename: 'test4.txt'
}

adb.remove(lookup)
	.then((filename: string) => {
		console.log(`removed: ${filename}`);
		return adb.restore(lookup);
	})
	.then((filename: string) => {
		console.log(`restored: ${filename}`);
	})
	.catch((err: string) => {
		t.fail(`${t.title}: ${err}`);
	});
```

The example above would remove the artifact `/Test2/Default/test4.txt` and place it in the trash.  After it is removed it is immediately restored back to its original path.  If there is a name collision on delete/restore, then the current timestamp is placed on the artifacts name.  In this example a file artifact is removed.  Sections and notebooks can also be removed/restored.

#### Emptying the Trash
Artifacts that were removed are not permanently removed until the trash is emptied.  That is performed with the `emptyTrash` method.

```javascript
const NotesDB = require('notesdb').NotesDB;

let adb = new NotesDB();
adb.emptyTrash()
	.then((adb: NotesDB) => {
		assert(_.isEmpty(adb.schema.trash));
	})
	.catch((err: string) => {
		t.fail(`${t.title}: ${err}`);
	});
```

#### Shutdown
The `shutdown` method immediately saves the binder, marks the instance as uninitialized, and turns off the automatic saving of documents.  It's a way to ensure proper cleanup once finished using this binder.

```javascript
const NotesDB = require('notesdb').NotesDB;

let adb = new NotesDB();
adb.shutdown()
	.then((msg: string) => {
		console.log(msg);
	})
	.catch((err: string) => {
		t.fail(`${t.title}: ${err}`);
	});
```

It returns a message indicating that the binder was shutdown.


## API

The API is generated with [JSDoc](https://www.npmjs.com/package/jsdoc).  It can be found within the `docs` directory for the project.  It can be generated with `npm run docs`.  An HTML site is generated in this directory that gives details on the api.

- [Artifact](docs/artifact.md)
- [NotesDB](docs/artifact.md)
