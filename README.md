# notesdb [![Build Status](https://travis-ci.org/jmquigley/notesdb.svg?branch=master)](https://travis-ci.org/jmquigley/notesdb) [![NPM](https://img.shields.io/npm/v/notesdb.svg)](https://www.npmjs.com/package/notesdb) [![Coverage Status](https://coveralls.io/repos/github/jmquigley/notesdb/badge.svg?branch=master)](https://coveralls.io/github/jmquigley/notesdb?branch=master)

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
 
 The main component is the artifact.  These are the text files.  The other items in the structure above are basic file directory strutures.

#### Features

- TODO


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

#### 

## API

The API is generated with [JSDoc](https://www.npmjs.com/package/jsdoc).  It can be found within the `docs` directory for the project.  It can be generated with `npm run docs`.
