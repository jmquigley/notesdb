<a name="Binder"></a>

## Binder
Creates an instance of the text binder class

**Kind**: global class  

* [Binder](#Binder)
    * [new Binder([opts])](#new_Binder_new)
    * [.add(opts, area, self)](#Binder+add) ⇒ <code>Promise</code>
    * [.create(schema, area, self)](#Binder+create) ⇒ <code>Promise</code>
    * [.emptyTrash(self)](#Binder+emptyTrash) ⇒ <code>Promise</code>
    * [.find(search, self)](#Binder+find) ⇒ <code>Promise</code>
    * [.get(opts, area, self)](#Binder+get) ⇒ <code>Promise</code>
    * [.hasArtifact(search, area, self)](#Binder+hasArtifact) ⇒ <code>boolean</code>
    * [.hasNotebook(search, area, self)](#Binder+hasNotebook) ⇒ <code>boolean</code>
    * [.hasSection(search, area, self)](#Binder+hasSection) ⇒ <code>boolean</code>
    * [.notebooks(sectionName, area, self)](#Binder+notebooks) ⇒ <code>Array</code>
    * [.reload(area, self)](#Binder+reload) ⇒ <code>Promise</code>
    * [.remove(opts, area, self)](#Binder+remove) ⇒ <code>Promise</code>
    * [.rename(src, dst, self)](#Binder+rename) ⇒ <code>Promise</code>
    * [.restore(opts, self)](#Binder+restore) ⇒ <code>Promise</code>
    * [.save(self)](#Binder+save) ⇒ <code>Promise</code>
    * [.saveArtifact(artifact)](#Binder+saveArtifact) ⇒ <code>Promise</code>
    * [.sections(area, self)](#Binder+sections) ⇒ <code>Array</code>
    * [.shutdown(self)](#Binder+shutdown) ⇒ <code>Promise</code>
    * [.toString(self)](#Binder+toString) ⇒ <code>string</code>
    * [.trash(opts, self)](#Binder+trash) ⇒ <code>Promise</code>

<a name="new_Binder_new"></a>

### new Binder([opts])
Creates the instance of the Binder class and loads or defines the
initial configuration parameters.  If the schema already exists, then
it will be loaded.


| Param | Type | Description |
| --- | --- | --- |
| [opts] | <code>object</code> | optional parameters - `binderName {string} default='adb'`: The name of the binder when a new database is being created.  This is optional.  When loading an existing database the name of the binder is retrieved as part of the configuration. - `configRoot {string} default='~/.notesdb'`: The name of the configuration directory where the configuration and log files are located. - `env {object}`: a copy of the current runtime environment variables.  This allows for the environment to be changed before instantiating the class (for multiple instances and testing). - `ignore {Array}`: the list of file names that this database will ignore when parsing/processing artifacts. - `root {string} default='~/.notesdb'`: The path location to the database.  This is optional and only needed when creating a new database. - `saveInterval {number} default='5000'`: determines how often a save check is performed.  The schema is scanned and saved very N millis. |

<a name="Binder+add"></a>

### binder.add(opts, area, self) ⇒ <code>Promise</code>
Creates the requested artifact within the schema.  This will attempt
to create each section, notebook, and document given.  If the item is
empty, then it is ignored.

The thenable return for this call is a reference to the artifact that
was created.

**Kind**: instance method of <code>[Binder](#Binder)</code>  
**Returns**: <code>Promise</code> - a javascript promise object  

| Param | Type | Description |
| --- | --- | --- |
| opts | <code>IArtifactSearch</code> | the artifact object to create (see above) |
| area | <code>string</code> | the namespace area within the schema object to search.  There are two areas: notes & trash. |
| self | <code>[Binder](#Binder)</code> | a reference to the notes database instance |

<a name="Binder+create"></a>

### binder.create(schema, area, self) ⇒ <code>Promise</code>
Creates new sections within a binder.  It takes a list of section
strings and creates a directory for each given string.

**Kind**: instance method of <code>[Binder](#Binder)</code>  
**Returns**: <code>Promise</code> - a javascript promise object  

| Param | Type | Description |
| --- | --- | --- |
| schema | <code>Array</code> &#124; <code>string</code> | a list of directories (sections) under this binder location.  Each of these directories will be created under this binder unless they already exist. |
| area | <code>string</code> | the namespace area within the schema object to search.  There are two areas: notes & trash. |
| self | <code>[Binder](#Binder)</code> | a reference to the notes database instance |

<a name="Binder+emptyTrash"></a>

### binder.emptyTrash(self) ⇒ <code>Promise</code>
Removes the current contents of the 'Trash' folder/section from the
current DB.  It also resets the internal trash namespace to empty.  This
will check that the directory requested is within the database location
and has the 'Trash' directory.

The thenable resolves to a reference to the Binder instance.

**Kind**: instance method of <code>[Binder](#Binder)</code>  
**Returns**: <code>Promise</code> - a javascript promise object.  

| Param | Type | Description |
| --- | --- | --- |
| self | <code>[Binder](#Binder)</code> | a reference to the notes database instance |

<a name="Binder+find"></a>

### binder.find(search, self) ⇒ <code>Promise</code>
Performs a text search against all artifacts within the repository.
This will return a list of all artifacts tha contain the requested
string.  The string can be a regex.

The thenable from this call is an Array of Artifacts that meet the
search criteria.

**Kind**: instance method of <code>[Binder](#Binder)</code>  
**Returns**: <code>Promise</code> - a javascript promise object  

| Param | Type | Description |
| --- | --- | --- |
| search | <code>string</code> | the regex string to used as the search criteria. |
| self | <code>[Binder](#Binder)</code> | a reference to the notes database instance |

<a name="Binder+get"></a>

### binder.get(opts, area, self) ⇒ <code>Promise</code>
Retrieves an artifact from the schema.  If it exists, then it is returned
by the promise.  If it is not found, then an error will be thrown.  If
the artifact has never been loaded before, then it is read from the
filesystem when this request is made.  This will place the artifact into
the recent documents queue.

When the request is a section or notebook a temporary artifact object
is created and returned.

The thenable resolves to the artifact created by the get request.

**Kind**: instance method of <code>[Binder](#Binder)</code>  
**Returns**: <code>Promise</code> - a javascript promise object.  

| Param | Type | Description |
| --- | --- | --- |
| opts | <code>IArtifactSearch</code> | the section/notebook/filename to search for within the schema. |
| area | <code>string</code> | the namespace area within the schema object to search.  There are two areas: notes & trash. |
| self | <code>[Binder](#Binder)</code> | a reference to the notes database instance |

<a name="Binder+hasArtifact"></a>

### binder.hasArtifact(search, area, self) ⇒ <code>boolean</code>
Checks to see if a document is in the repository by name, notebook and
section.

**Kind**: instance method of <code>[Binder](#Binder)</code>  
**Returns**: <code>boolean</code> - true if the artifact is found, otherwise false  

| Param | Type | Description |
| --- | --- | --- |
| search | <code>IArtifactSearch</code> | an object that represents the item to find in the schema. |
| area | <code>string</code> | the namespace area within the schema object to search.  There are two areas: notes & trash. |
| self | <code>[Binder](#Binder)</code> | a reference to the notes database instance |

<a name="Binder+hasNotebook"></a>

### binder.hasNotebook(search, area, self) ⇒ <code>boolean</code>
Checks the given section for the existence of a notebook by name.

**Kind**: instance method of <code>[Binder](#Binder)</code>  
**Returns**: <code>boolean</code> - true if the notebook is found, otherwise false  

| Param | Type | Description |
| --- | --- | --- |
| search | <code>IArtifactSearch</code> | an object that represents the item to find in the schema. |
| area | <code>string</code> | the namespace area within the schema object to search.  There are two areas: notes & trash. |
| self | <code>[Binder](#Binder)</code> | a reference to the notes database instance |

<a name="Binder+hasSection"></a>

### binder.hasSection(search, area, self) ⇒ <code>boolean</code>
Checks the current schema for the existence of a section.

**Kind**: instance method of <code>[Binder](#Binder)</code>  
**Returns**: <code>boolean</code> - true if the section is found, otherwise false.  

| Param | Type | Description |
| --- | --- | --- |
| search | <code>IArtifactSearch</code> | an object that represents the item to find in the schema. |
| area | <code>string</code> | the namespace area within the schema object to search.  There are two areas: notes & trash. |
| self | <code>[Binder](#Binder)</code> | a reference to the notes database instance |

<a name="Binder+notebooks"></a>

### binder.notebooks(sectionName, area, self) ⇒ <code>Array</code>
Enumerates the list of notebooks in a section from the schema.
returns {Array} a list of the notebooks for a section

**Kind**: instance method of <code>[Binder](#Binder)</code>  
**Returns**: <code>Array</code> - a list of notebook names as strings  

| Param | Type | Description |
| --- | --- | --- |
| sectionName | <code>string</code> | the name of the section where the notebooks are located. |
| area | <code>string</code> | the namespace area within the schema object to search.  There are two areas: notes & trash. |
| self | <code>[Binder](#Binder)</code> | a reference to the notes database instance |

<a name="Binder+reload"></a>

### binder.reload(area, self) ⇒ <code>Promise</code>
Scans the current repository directory to rebuild the schema.  This
only needs to be done if a file/artifact is added to the directory
structure after the instance has been loaded.

**Kind**: instance method of <code>[Binder](#Binder)</code>  
**Returns**: <code>Promise</code> - a javascript promise object.  

| Param | Type | Description |
| --- | --- | --- |
| area | <code>string</code> | the namespace area within the schema object to search.  There are two areas: notes & trash. |
| self | <code>[Binder](#Binder)</code> | a reference to the notes database instance |

<a name="Binder+remove"></a>

### binder.remove(opts, area, self) ⇒ <code>Promise</code>
Immediately removes an section/notebook/artifact from the system.

The thenable resolves to a reference to the Binder instance.

**Kind**: instance method of <code>[Binder](#Binder)</code>  
**Returns**: <code>Promise</code> - a javascript promise object  

| Param | Type | Description |
| --- | --- | --- |
| opts | <code>IArtifactSearch</code> | the section/notebook/filename to search for within the schema. |
| area | <code>string</code> | the namespace area within the schema object to search.  There are two areas: notes & trash. |
| self | <code>[Binder](#Binder)</code> | a reference to the notes database instance |

<a name="Binder+rename"></a>

### binder.rename(src, dst, self) ⇒ <code>Promise</code>
Renames an artifact from the source (src) to destination (dst).

The thenable resolves to a reference to the renamed artifact.

**Kind**: instance method of <code>[Binder](#Binder)</code>  
**Returns**: <code>Promise</code> - a javascript promise object.  

| Param | Type | Description |
| --- | --- | --- |
| src | <code>IArtifactSearch</code> | the source artifact that will be changed |
| dst | <code>IArtifactSearch</code> | the destination artifact that the source will be changed into. |
| self | <code>[Binder](#Binder)</code> | a reference to the notes database instance |

<a name="Binder+restore"></a>

### binder.restore(opts, self) ⇒ <code>Promise</code>
Takes an item from the trash and puts it back into the schema.  If the
item is already in the schema, then it appends a timestamp to the name
of the item that is being restored.

The thenable resolves to the artifact that was retored.

**Kind**: instance method of <code>[Binder](#Binder)</code>  
**Returns**: <code>Promise</code> - a javascript promise object.  

| Param | Type | Description |
| --- | --- | --- |
| opts | <code>IArtifactSearch</code> | The section/notebook/filename to restore |
| self | <code>[Binder](#Binder)</code> | a reference to the notes database instance |

<a name="Binder+save"></a>

### binder.save(self) ⇒ <code>Promise</code>
User requested save function.  If given an artifact, then a single
save is performed.  If no artifact is specifid, then the binder
artifact list is scanned for dirty artifacts that need to be saved.

The thenable resolves to a reference to the Binder instance.

**Kind**: instance method of <code>[Binder](#Binder)</code>  
**Returns**: <code>Promise</code> - a javascript promise object  

| Param | Type | Description |
| --- | --- | --- |
| self | <code>[Binder](#Binder)</code> | a reference to the notes database instance |

<a name="Binder+saveArtifact"></a>

### binder.saveArtifact(artifact) ⇒ <code>Promise</code>
Performs a save of a single artifact.

**Kind**: instance method of <code>[Binder](#Binder)</code>  
**Returns**: <code>Promise</code> - a javascript promise object  

| Param | Type | Description |
| --- | --- | --- |
| artifact | <code>Artifact</code> | the artifact value to save |

<a name="Binder+sections"></a>

### binder.sections(area, self) ⇒ <code>Array</code>
Enumerates the list of sections from the schema.

**Kind**: instance method of <code>[Binder](#Binder)</code>  
**Returns**: <code>Array</code> - a list of section names as strings  

| Param | Type | Description |
| --- | --- | --- |
| area | <code>string</code> | the namespace area within the schema object to search.  There are two areas: notes & trash. |
| self | <code>[Binder](#Binder)</code> | a reference to the notes database instance |

<a name="Binder+shutdown"></a>

### binder.shutdown(self) ⇒ <code>Promise</code>
Called when the database is no longer needed.  This will cleanup
operations and shutdown the intervals.

**Kind**: instance method of <code>[Binder](#Binder)</code>  
**Returns**: <code>Promise</code> - a javascript promise object  

| Param |
| --- |
| self | 

<a name="Binder+toString"></a>

### binder.toString(self) ⇒ <code>string</code>
Converts the internal structures to a string and returns it.

**Kind**: instance method of <code>[Binder](#Binder)</code>  
**Returns**: <code>string</code> - a string that shows the configuration and schema for
the database.  

| Param | Type | Description |
| --- | --- | --- |
| self | <code>[Binder](#Binder)</code> | a reference to the notes database instance |

<a name="Binder+trash"></a>

### binder.trash(opts, self) ⇒ <code>Promise</code>
Moves an artifact from it's current directory to the "Trash" folder.  It
is not removed until the emptyTrash() method is called.  The artifact
is removed from the schema dictionary and stored in the trash dictionary.

The thenable resolves to the artifact that was moved to the trash.

**Kind**: instance method of <code>[Binder](#Binder)</code>  
**Returns**: <code>Promise</code> - a javascript promise object.  

| Param | Type | Description |
| --- | --- | --- |
| opts | <code>IArtifactSearch</code> | the section/notebook/filename to remove for within the schema. |
| self | <code>[Binder](#Binder)</code> | a reference to the notes database instance |

