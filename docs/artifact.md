<a name="Artifact"></a>

## Artifact
A container class that holds the information for a single artifact within
the database.

**Kind**: global class  

* [Artifact](#Artifact)
    * [new Artifact()](#new_Artifact_new)
    * _instance_
        * [.buffer](#Artifact+buffer) ⇒ <code>Buffer</code>
        * [.addTag(tag)](#Artifact+addTag)
    * _static_
        * [.isType(search)](#Artifact.isType) ⇒ <code>ArtifactType</code>
        * [.factory(mode, [opts])](#Artifact.factory) ⇒ <code>[Artifact](#Artifact)</code>

<a name="new_Artifact_new"></a>

### new Artifact()
The constructor is private.  Objects must be created with the factory

<a name="Artifact+buffer"></a>

### artifact.buffer ⇒ <code>Buffer</code>
Takes the current input "buf", converts it to a buffer, and returns it

**Kind**: instance property of <code>[Artifact](#Artifact)</code>  
**Returns**: <code>Buffer</code> - a new instance of the input data as a buffer.  
<a name="Artifact+addTag"></a>

### artifact.addTag(tag)
Adds a unique tag to the artifact.

**Kind**: instance method of <code>[Artifact](#Artifact)</code>  

| Param | Type | Description |
| --- | --- | --- |
| tag | <code>string</code> | the name of the tag to add. |

<a name="Artifact.isType"></a>

### Artifact.isType(search) ⇒ <code>ArtifactType</code>
Takes artifact search information and builds the type id

**Kind**: static method of <code>[Artifact](#Artifact)</code>  
**Returns**: <code>ArtifactType</code> - the id associated with this search.  

| Param | Type | Description |
| --- | --- | --- |
| search | <code>IArtifactSearch</code> | an object that contains the current Artifact parameters used to build the type id. |

<a name="Artifact.factory"></a>

### Artifact.factory(mode, [opts]) ⇒ <code>[Artifact](#Artifact)</code>
A factory method for creating different types of artifacts.  The mode
determines what type of Artifact object will be factory and returned.
The types include:

- all|default - use a object with properties for each field to factory the object
and set its properties
- treeitem - represents an object that can be parsed in the treetitem
format of {section}/{notebook}/{filename}
- empty - just return an empty object.  This is the default.

**Kind**: static method of <code>[Artifact](#Artifact)</code>  
**Returns**: <code>[Artifact](#Artifact)</code> - a newly constructed artifact object.  

| Param | Type | Description |
| --- | --- | --- |
| mode | <code>string</code> | tells the factory what to make |
| [opts] | <code>Object</code> &#124; <code>string</code> | parameters to the facility that will make the object. |

