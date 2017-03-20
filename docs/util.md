<a name="module_util"></a>

## util
This module contains helper functions used in the txtdb.  They represent
private functions that are not exposed as part of the main module.


* [util](#module_util)
    * [~addConsole(logger)](#module_util..addConsole)
    * [~getDirectories(src)](#module_util..getDirectories) ⇒ <code>Array</code>
    * [~getUUID(nodash)](#module_util..getUUID) ⇒ <code>string</code>

<a name="module_util..addConsole"></a>

### util~addConsole(logger)
Adds a console logging appender to to the logging facility used by the TxtDB
class.  It checks to see if there is already a console logger in the config.
If it is already there, then it is not added again.

**Kind**: inner method of <code>[util](#module_util)</code>  

| Param | Type | Description |
| --- | --- | --- |
| logger | <code>Logger</code> | a reference to the log4j object. |

<a name="module_util..getDirectories"></a>

### util~getDirectories(src) ⇒ <code>Array</code>
Retrieves a list of directories from the given input path.

**Kind**: inner method of <code>[util](#module_util)</code>  
**Returns**: <code>Array</code> - a list of directories.  

| Param | Type | Description |
| --- | --- | --- |
| src | <code>string</code> | the source directory to search for sub directories |

<a name="module_util..getUUID"></a>

### util~getUUID(nodash) ⇒ <code>string</code>
Retrieves a version 4 uuid.  It can be with or without the dash characters.

**Kind**: inner method of <code>[util](#module_util)</code>  
**Returns**: <code>string</code> - a v4 uuid  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| nodash | <code>boolean</code> | <code>false</code> | if true, the dashes are removed, otherwise just a v4 uuid is created. |

