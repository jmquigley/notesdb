# notesdb [![Build Status](https://travis-ci.org/jmquigley/notesdb.svg?branch=master)](https://travis-ci.org/jmquigley/notesdb) [![tslint code style](https://img.shields.io/badge/code_style-TSlint-5ed9c7.svg)](https://palantir.github.io/tslint/) [![Test Runner](https://img.shields.io/badge/testing-ava-blue.svg)](https://github.com/avajs/ava) [![NPM](https://img.shields.io/npm/v/notesdb.svg)](https://www.npmjs.com/package/notesdb) [![Coverage Status](https://coveralls.io/repos/github/jmquigley/notesdb/badge.svg?branch=master)](https://coveralls.io/github/jmquigley/notesdb?branch=master)

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

This module uses [yarn](https://yarnpkg.com/en/) to manage dependencies and run scripts for development.

To install as an application dependency:
```
$ yarn add --dev notesdb
```

To build the app and run all tests:
```
$ yarn run all
```


## Usage

### BinderManager
This class is used to manage multiple Binder instances and their associated configurations.  See the `Binder` api below for details.

The [public api](docs/lib/bindermanager.md) contains the following functions:

- [add()](docs/lib/bindermanagers.md#BinderManager+add)
- [emptyTrash()](docs/lib/bindermanagers.md#BinderManager+emptyTrash)
- [get()](docs/lib/bindermanagers.md#BinderManager+get)
- [hasBinder()](docs/lib/bindermanagers.md#BinderManager+hasBinder)
- [info()](docs/lib/bindermanagers.md#BinderManager+info)
- [list()](docs/lib/bindermanagers.md#BinderManager+list)
- [remove()](docs/lib/bindermanagers.md#BinderManager+remove)
- [shutdown()](docs/lib/bindermanagers.md#BinderManager+shutdown)


#### Creating a manager instance

```javascript
import {BinderManager} from 'notesdb';

let manager = new BinderManager('/some/config/location');
```

This will create a new manager instance.  It will also create a `default` binder within it if one does not exist.  The default binder is stored in `{HOME}/Notebooks/default`.

#### Adding a new binder

```javascript
import {BinderManager} from 'notesdb';

let manager = new BinderManager('/some/config/location');
manager.add('sampledb', '/directory/to/store/files');
```

This will add a new binder named `sampledb` if it doesn't exist.  All data files created/saved by the binder will be stored in the directory `/directory/to/store/files`.

#### Remove a binder from the manager

```javascript
import {BinderManager} from 'notesdb';

let manager = new BinderManager('/some/config/location');
manager.remove('sampledb');
manager.emptyTrash();
```

If the binder `sampledb` exists, then it will be moved to a trash directory.  The location of the trash directory is determined by the manager instance at creation.  In this example deleted binders would be stored in `/some/config/location/binders/Trash`.  They are not removed from disk, but are basically stored to the trash directory.  A call to `emptyTrash()` will permanently remove that binder's configuration details (but never the data files in the binder).


### Binder
The [public api](docs/lib/binder.md) contains the following functions:

- [add()](docs/lib/binder.md#Binder+add)
- [create()](docs/lib/binder.md#Binder+create)
- [emptyTrash()](docs/lib/binder.md#Binder+emptyTrash)
- [find()](docs/lib/binder.md#Binder+find)
- [get()](docs/lib/binder.md#Binder+get)
- [hasArtifact()](docs/lib/binder.md#Binder+hasArtifact)
- [hasNotebook()](docs/lib/binder.md#Binder+hasNotebook)
- [hasSection()](docs/lib/binder.md#Binder+hasSection)
- [notebooks()](docs/lib/binder.md#Binder+notebooks)
- [reload()](docs/lib/binder.md#Binder+reload)
- [remove()](docs/lib/binder.md#Binder+remove)
- [rename()](docs/lib/binder.md#Binder+rename)
- [restore()](docs/lib/binder.md#Binder+restore)
- [save()](docs/lib/binder.md#Binder+save)
- [saveArtifact()](docs/lib/binder.md#Binder+saveArtifact)
- [sections()](docs/lib/binder.md#Binder+sections)
- [shutdown()](docs/lib/binder.md#Binder+shutdown)
- [toString()](docs/lib/binder.md#Binder+toString)
- [trash()](docs/lib/binder.md#Binder+trash)

#### Creating an Instance
To construct a new instance:

```javascript
import {Binder} from 'notesdb';

let adb = new Binder();
```

Loads a default instance of the schema.  This example contains no configuration options.  It will use the default configuration directory of `~/.notesdb`.  The configuration file for this instance is saved in `~/.notesdb/config.json`.  The log file for the database is saved within this directory in `~/notesdb/notesdb.log`.  The default name of the database is `adb` (the name of the binder) and is saved in `~/.notesdb/adb`.  This is where all sections, notebooks, and artifacts will be saved.

An instance can be created with a new set of defaults:

```javascript
import {Binder} from 'notesdb';

let adb = new Binder({
    binderName: 'sampledb',
    root: '~/mydb'
});
```

This will create a new binder with the name `sampledb`.  It also changes where the configuration will be saved with the *root* option.  This is the default location where the schema will be stored.  If only the root is specified, then the configuration is also located in this directory.  This database is saved in `~/mydb/sampledb`.  The configuration and the database can be separated:

```javascript
import {Binder} from 'notesdb';

let adb = new Binder({
    binderName: 'sampledb',
    configRoot: '~/mydbconfig',
    root: '~/mydb'
});
```

This will create the database in `~/mydb/sampledb` and the configuration/logs are stored in `~/mydbconfig`.

#### Creating Sections
Once an instance is created sections can be added.  There are two ways to do this.  The `create()` or `add`.  Using the create method:

```javascript
import {Binder} from 'notesdb';

let adb = new Binder();
adb.create(['Test1', 'Test2'])
    .then((adb: Binder) => {
        // After the call to create the sections we list them after async creation
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
import {Artifact, Binder} from 'notesdb';

let adb = new Binder();
adb.add(Artifact.factory('fields', {section: 'Test1'}))
    .then((artifact: Artifact) => {
        console.log(artifact.toString());
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

This will create a new section named `Test1` within a default notebook.


#### Creating Notebooks
A notebook is created with the `add` method.

```javascript
import {Artifact, Binder} from 'notesdb';

let adb = new Binder();
adb.add(Artifact.factory('fields', {section: 'Test1', notebook: 'MyNotebook'}))
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
import {Artifact, Binder} from 'notesdb';

let adb = new Binder();
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
import {Artifact, Binder} from 'notesdb';

let adb = new Binder();
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
import {Artifact, Binder} from 'notesdb';

let adb = new Binder();
adb.find('#1')
    .then((artifacts: Array<Artifact>) => {
        artifacts.forEach((artifact: Artifact) => {
            console.log(artifact.absolute());
        });
    })
    .catch((err: string) => {
        console.error(err);
    });
```

This call would find all artifacts that contain the string `#1` and return an array.

#### Renaming Artifacts
The name of an artifact can be changed using the `rename` method.  It takes two parameters: the source location and the destination location:

```javascript
import {Binder} from 'notesdb';

let adb = new Binder();
let src = {
    section: 'Test1',
    notebook: 'Default',
    filename: 'test4.txt'
}

let dst = {
    section: 'Test2',
    notebook: 'Default',
    filename: 'test4.txt'
}

adb.rename(src, dst)
    .then((filename: string) => {
        console.log(`renamed to: ${filename}`);
    })
    .catch((err: string) => {
        console.error(err);
    });

```

This example will rename the artifact `Test1/Default/test4.txt` to `Test2/Default/test4.txt`.

#### Trashing/Restoring Artifacts
Artifacts are not removed from the system directly (generally).  They are first moved to a special `Trash` folder within the notebook.  An artifact is removed with the `trash` method.  A removed artifact can be recovered from the trash using the `restore` method:

```javascript
import {Binder} from 'notesdb';

let adb = new Binder();
let lookup = {
    section: 'Test2',
    notebook: 'Default',
    filename: 'test4.txt'
}

adb.trash(lookup)
    .then((filename: string) => {
        console.log(`trashed: ${filename}`);
        return adb.restore(lookup);
    })
    .then((filename: string) => {
        console.log(`restored: ${filename}`);
    })
    .catch((err: string) => {
        console.error(err);
    });
```

The example above would move the artifact `/Test2/Default/test4.txt` and place it in the trash.  After it is removed it is immediately restored back to its original path.  If there is a name collision on delete/restore, then the current timestamp is placed on the artifacts name.  In this example a file artifact is removed.  Sections and notebooks can also be removed/restored.

#### Emptying the Trash
Artifacts that were removed are not permanently removed until the trash is emptied.  That is performed with the `emptyTrash` method.

```javascript
import {Binder} from 'notesdb';

let adb = new Binder();
adb.emptyTrash()
    .then((adb: Binder) => {
        assert(_.isEmpty(adb.schema.trash));
    })
    .catch((err: string) => {
        console.error(err);
    });
```

#### Shutdown
The `shutdown` method immediately saves the binder, marks the instance as uninitialized, and turns off the automatic saving of documents.  It's a way to ensure proper cleanup once finished using this binder.

```javascript
import {Binder} from 'notesdb';

let adb = new Binder();
adb.shutdown()
    .then((msg: string) => {
        console.log(msg);
    })
    .catch((err: string) => {
        console.error(err);
    });
```

It returns a message indicating that the binder was shutdown.


## API

The API is generated with [JSDoc](https://www.npmjs.com/package/jsdoc).  It can be found within the `docs` directory for the project.  It can be generated with `npm run docs`.

- [Artifact](docs/lib/artifact.md)
- [Binder](docs/lib/binder.md)
- [BinderManager](docs/lib/bindermanager.md)
