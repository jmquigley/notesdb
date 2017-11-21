<a name="BinderManager"></a>

## BinderManager
Creates an instance of the binder management class

**Kind**: global class  

* [BinderManager](#BinderManager)
    * [new BinderManager(baseDirectory)](#new_BinderManager_new)
    * [.add(binderName, binderDirectory)](#BinderManager+add) ⇒
    * [.emptyTrash()](#BinderManager+emptyTrash) ⇒ <code>Array.&lt;string&gt;</code>
    * [.get(binderName)](#BinderManager+get)
    * [.hasBinder(binderName)](#BinderManager+hasBinder) ⇒ <code>boolean</code>
    * [.info()](#BinderManager+info) ⇒ <code>string</code>
    * [.list()](#BinderManager+list) ⇒
    * [.remove(binderName)](#BinderManager+remove) ⇒ <code>string</code>
    * [.shutdown()](#BinderManager+shutdown)

<a name="new_BinderManager_new"></a>

### new BinderManager(baseDirectory)
Creates a new instance of the BinderManager class.  An instance is used
to manage multiple binder instances and centralize their configuration
details.

The baseDirectory option points to a directory that will hold another sub
directory named "binders".  Each of these directories hold the configuration
details for a single Binder.


| Param | Type | Description |
| --- | --- | --- |
| baseDirectory | <code>string</code> | the location where all of the notebook configurations that are managed by this instance are stored. |

<a name="BinderManager+add"></a>

### binderManager.add(binderName, binderDirectory) ⇒
Adds a new Binder instance to the manager.  This will only add the binder if
it doesn't exist.

**Kind**: instance method of [<code>BinderManager</code>](#BinderManager)  
**Returns**: success if the add works, otherwise failure.  

| Param | Type | Description |
| --- | --- | --- |
| binderName | <code>string</code> | The name of the binder to create |
| binderDirectory | <code>string</code> | The location of the data files for this binder |

<a name="BinderManager+emptyTrash"></a>

### binderManager.emptyTrash() ⇒ <code>Array.&lt;string&gt;</code>
Permanently removes the contents of the `Trash` directory.  This directory
is filled by the `remove()`.

**Kind**: instance method of [<code>BinderManager</code>](#BinderManager)  
**Returns**: <code>Array.&lt;string&gt;</code> - an array containing the directories that were removed.  
<a name="BinderManager+get"></a>

### binderManager.get(binderName)
Retrieves a Binder instance from the manager by name.

**Kind**: instance method of [<code>BinderManager</code>](#BinderManager)  

| Param | Type | Description |
| --- | --- | --- |
| binderName | <code>string</code> | The name of the binder to find. then undefined is returned. |

<a name="BinderManager+hasBinder"></a>

### binderManager.hasBinder(binderName) ⇒ <code>boolean</code>
Checks the current binder list for the existence of the requested
binder.

**Kind**: instance method of [<code>BinderManager</code>](#BinderManager)  
**Returns**: <code>boolean</code> - true if the binder is found within the manager otherwise
false.  

| Param | Type | Description |
| --- | --- | --- |
| binderName | <code>string</code> | The name of the binder to find. |

<a name="BinderManager+info"></a>

### binderManager.info() ⇒ <code>string</code>
Retrieves information about each of the binders under control of the manager

**Kind**: instance method of [<code>BinderManager</code>](#BinderManager)  
**Returns**: <code>string</code> - a string representing each of the binders in the manager  
<a name="BinderManager+list"></a>

### binderManager.list() ⇒
Retrieves the list of binders under control of this manager.  The trash folder
is excluded from the list.

**Kind**: instance method of [<code>BinderManager</code>](#BinderManager)  
**Returns**: an array of strings that represent the binder names.  If there are no
binders, then an empty array is returned.  
<a name="BinderManager+remove"></a>

### binderManager.remove(binderName) ⇒ <code>string</code>
Moves the given binder name to the Trash directory.  A timestamp is added
to the name of the moved binder.  If the binder doean't exist, then a warning
message is written to the manager log file.

**Kind**: instance method of [<code>BinderManager</code>](#BinderManager)  
**Returns**: <code>string</code> - the path to the newly removed item (to the trash)  

| Param | Type | Description |
| --- | --- | --- |
| binderName | <code>string</code> | the name of the binder that will be moved |

<a name="BinderManager+shutdown"></a>

### binderManager.shutdown()
Iterates through all binder instances and calls their shutdown
methods.

**Kind**: instance method of [<code>BinderManager</code>](#BinderManager)  
