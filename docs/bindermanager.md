<a name="BinderManager"></a>

## BinderManager
Creates an instance of the binder management class

**Kind**: global class  

* [BinderManager](#BinderManager)
    * [new BinderManager(baseDirectory)](#new_BinderManager_new)
    * [.add(binderName, binderDirectory)](#BinderManager+add) ⇒
    * [.get(binderName)](#BinderManager+get) ⇒ <code>Binder</code>
    * [.load(self)](#BinderManager+load)

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

**Kind**: instance method of <code>[BinderManager](#BinderManager)</code>  
**Returns**: success if the add works, otherwise false.  

| Param | Type | Description |
| --- | --- | --- |
| binderName | <code>string</code> | The name of the binder to create |
| binderDirectory | <code>string</code> | The location of the data files for this binder |

<a name="BinderManager+get"></a>

### binderManager.get(binderName) ⇒ <code>Binder</code>
Retrieves a Binder instance from the manager by name.

**Kind**: instance method of <code>[BinderManager](#BinderManager)</code>  
**Returns**: <code>Binder</code> - a reference to the binder within the manager.  If it doesn't exist
then undefined is returned.  

| Param | Type | Description |
| --- | --- | --- |
| binderName | <code>string</code> | The name of the binder to find. |

<a name="BinderManager+load"></a>

### binderManager.load(self)
Reads all of the binders in given binder directory, attemps to instantiate them,
and save their references in the _binders array.

**Kind**: instance method of <code>[BinderManager](#BinderManager)</code>  

| Param | Type | Description |
| --- | --- | --- |
| self | <code>[BinderManager](#BinderManager)</code> | reference to the current instance of this class |

