# notesdb [![Build Status](https://travis-ci.org/jmquigley/notesdb.svg?branch=master)](https://travis-ci.org/jmquigley/notesdb) [![NPM](https://img.shields.io/npm/v/notesdb.svg)](https://www.npmjs.com/package/notesdb) [![Coverage Status](https://coveralls.io/repos/github/jmquigley/notesdb/badge.svg?branch=master)](https://coveralls.io/github/jmquigley/notesdb?branch=master)

> A text file notes database

This is a placeholder for a future module and a work in progress.

The text database is just a datastructure and a set of functions to manipulate a structured directory.  The "database" is refered to as a binder.  The binder contains sections.  Each of the sections contain notebooks.  Each notebook contains artifacts (files).  The general structure of the binder is:
 
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
 
 The main component is the artifact.  These are the text files.  The others are basic file directory strutures.

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

- TODO


## API

### Constructor

- `NotesDB({opts})`: creates or loads an instance of the Note database.

##### options

- `binderName {string} default='adb'`: The name of the binder when a new database is being created.  This is optional.  When loading an existing database the name of the binder is retrieved as part of the configuration.
- `configFile {string} default='~/.notesdb/config.json'`: The name of the configuration file used to load or create a database.
- `env {object}`: a copy of the current runtime environment variables.  This allows for the environment to be changed before instantiating the class (for multiple instances).
- `ignore {Array}`: the list of file names that this database will ignore when parsing/processing artifacts.
- `root {string} default='~/.notesdb'`: The path location to the database.  This is optional and only needed when creating a new database.
- `saveInterval {number} default='5000'`: determines how often a save check is performed.
