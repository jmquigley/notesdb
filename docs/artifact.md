## Classes

<dl>
<dt><a href="#Artifact">Artifact</a></dt>
<dd><p>A container class that holds the information for a single artifact within
the database.</p>
</dd>
</dl>

## Functions

<dl>
<dt><a href="#artifactComparator">artifactComparator(o1, o2)</a> ⇒ <code>number</code></dt>
<dd><p>Performs a comparison between two Artifact objects.  It uses the absolute
path for each artifact as the basis of the comparison.  This function is
used with the data structures in the util.ds objects.</p>
</dd>
</dl>

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
        * [.makeUnique()](#Artifact+makeUnique) ⇒ <code>[Artifact](#Artifact)</code>
    * _static_
        * [.isType(search)](#Artifact.isType) ⇒ <code>ArtifactType</code>
        * [.factory(mode, [opts], [artifact])](#Artifact.factory) ⇒ <code>[Artifact](#Artifact)</code>

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

<a name="Artifact+makeUnique"></a>

### artifact.makeUnique() ⇒ <code>[Artifact](#Artifact)</code>
Takes an artifact and appends a timestamp to the last part of its path

**Kind**: instance method of <code>[Artifact](#Artifact)</code>  
**Returns**: <code>[Artifact](#Artifact)</code> - the modified artifact with a timestamp attached to
the last element of the path.  
<a name="Artifact.isType"></a>

### Artifact.isType(search) ⇒ <code>ArtifactType</code>
Takes artifact search information and builds the type id

**Kind**: static method of <code>[Artifact](#Artifact)</code>  
**Returns**: <code>ArtifactType</code> - the id associated with this search.  

| Param | Type | Description |
| --- | --- | --- |
| search | <code>IArtifactSearch</code> | an object that contains the current Artifact parameters used to build the type id. |

<a name="Artifact.factory"></a>

### Artifact.factory(mode, [opts], [artifact]) ⇒ <code>[Artifact](#Artifact)</code>
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

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| mode | <code>string</code> |  | tells the factory what to make |
| [opts] | <code>Object</code> &#124; <code>string</code> |  | parameters to the facility that will make the object. |
| [artifact] | <code>[Artifact](#Artifact)</code> | <code></code> | if an instance is passed to this factory then it is used instead of creating a new one.  Works like a copy constructor. |

<a name="artifactComparator"></a>

## artifactComparator(o1, o2) ⇒ <code>number</code>
Performs a comparison between two Artifact objects.  It uses the absolute
path for each artifact as the basis of the comparison.  This function is
used with the data structures in the util.ds objects.

**Kind**: global function  
**Returns**: <code>number</code> - 0 if o1 & o2 are the same, 1 if o1 > o2, -1 if o1 < o2.  

| Param | Type | Description |
| --- | --- | --- |
| o1 | <code>[Artifact](#Artifact)</code> | the first artifact to compare. |
| o2 | <code>[Artifact](#Artifact)</code> | the second artifact to compare. |

