# unimodel-core

Unimodel is a specification and framework for creating models across multiple different data
sources that behave the same.  Model implementors must override the relevant methods on the
base classes, and model users can expect a consistent interface.

## Overview

Unimodel centers around two concepts - models and documents.

A _model_ is an object that handles dealing with a particular collection of objects in a datastore.
Models contain methods such as `find()` and `create()` that interact with the collection itself
rather than individual objects contained inside the collection.

A _document_ is a single object inside of a collection.  Models have methods that return documents,
and documents contain methods that interact with that single object, such as `save()` and `remove()`.

In Unimodel, both models and documents are represented by ES6 classes.  The class (constructor) for
the model is called the _model class_ and the class (constructor) for documents is called the
_document class_.  Unlike similar model systems, methods on the model like `find()` are actually
instance methods on the model, instead of static methods on the model class.

Model classes can be abstract, such that multiple different types of models can be instantiated
from a model class.  For example, the following models and documents could be involved in a system
storing Animal objects in a Mongo database.

- A `MongoModel` model class which creates models stored in a Mongo database.
- An `Animals` instance of MongoModel which includes the schema and collection name of animals.
- A `MongoDocument` document class which is used to instantiate Mongo objects.
- Multiple `animal` objects which are instances of `MongoDocument`, created using `Animals.create()`.

Here's another example where the model is not on top of a generic database, but is instead on top
of a specific API (say, Twitter).

- A `TweetModel` model class which creates tweet models.
- A `Tweets` model, containing `find()`, `create()`, etc.
- A `Tweet` document class which is used to instantiate Tweet documents.
- Many `tweet` objects which are instances of `TweetDocument` and correspond to individual tweets.

## Model

To create a model, inherit from the base `Model` class and override any of its methods that you support.

```js
const Model = require('unimodel-core').Model;
```

These methods are:

### constructor()

The constructor takes no options by default.  Child classes may add options (for example, the Mongo
model above would take a schema and collection name as constructor parameters).

### getName()

Returns a name that can be used for the model.  It should be uppercase and pluralized.  For example,
`Animals`.

### getKeys()

Returns an array of field names which are used to key the document.  These field names are in order
from most specific to least specific.  For example, a model that stores cities might have the keys
`[ 'cityName', 'state', 'country', 'planet' ]`.

### getType()

Returns the base model type, which is typically simply the constructor name.
For example, `UnimongoModel` or `ElasticsearchModel`.

### find(query[, options])

This method performs a query on the database and returns a promise that resolve with the results.
The query is a common-query query which should be transformed to whatever the underlying database
supports.  If an unsupported query operator is used, `find()` should throw an `UNSUPPORTED_OPERATION`
XError.

Standard options are: (individual models can add their own model-specific options)

- `skip` - Number of documents at the start of the result set to skip over
- `limit` - Maximum number of results to return.  Models may set their own defaults.
- `fields` - An array of field names to return, by default all fields are returned
- `total` - If set to boolean `true`, the returned result array also contains a property called
  `total` which contains the total number of results without the limit.
- `sort` - An array of field names to sort by.  Each field name can be optionally prefixed
  with `-` to reverse its sort order.

```js
model.find(
	{ foo: { $gt: 5 } },
	{
		fields: [ 'thing', 'thing2.subfield' ],
		total: true
	}
).then( function(results) {
	// results = [ document1, document2 ]
	// results.total = 2
} )
```

If `find()` is not overridden but `findStream()` is, the default implementation of `find()` will
use `findStream()` to return results.

### findStream(query[, options])

This method is similar to `find()` but instead of returning a promise that resolves with an array
of results, `findStream()` returns a readable object stream to stream results.  It takes the same
options as `find()`.

The returned stream should be a zstreams readable object stream with the `DocumentStream` class
mixed in.  This returned stream should contain a method called `getTotal()`, which returns a
promise resolving with the total number of results.

```js
model.findStream({ foo: { $gt: 5 } }).intoArray().then(...);
```

If `findStream()` is not overridden, but `find()` is, the default implementation will use `find()`
and construct a fake readable stream.

### findOne(query[, options])

This method is like `find`, but returns only the first result if any are found.

```js
model.findOne({ foo: { $gt: 5 } }).then(...);
```

### count(query[, options])

Takes the same options as `find()`.  Returns a promise that resolves with the count of documents
matching the query.

### create([data])

Creates and returns a new document, optionally with the provided data.  This does not immediately
save to the database.  Call `save()` on the document to save it.

```js
var animal = animals.create({
	animalType: 'cat',
	name: 'Toby'
});
```

### aggregate(query, aggregate[, options])

This method performs an aggregate on a collection (ie, statistics or grouping).

The `query` argument specifies a filter.  The aggregate only operates on documents matched by the filter.

The `aggregate` option specifies an aggregate spec (instructions on how to perform the aggregate).  See
the `Aggregates` section below for details on how to specify aggregates.

Options can include:

- `limit` - Maximum number of result entries to return.
- `sort` - Array of fields to sort the results by.  These fields reference the result entries.  For
  example, a sort field could be `age.avg` .

```js
model.aggregate({
	shelterLocation: 'Clifton'
}, {
	type: 'stats',
	stats: {
		age: {
			max: true
		}
	}
}, {
	limit: 5,
	sort: [ 'stats.age.max' ]
}).then(function(results) {
	// ...
});
```

### aggregateMulti(query, aggregates[, options])

This method performs multiple aggregations at once.  It behaves the same as `aggregate()`, but the
`aggregates` argument is a map from keys to aggregate specs, and the result object is a map from
the same keys to aggregate results.

```js
model.aggregateMulti({
	shelterLocation: 'Clifton'
}, {
	foo: {
		type: 'stats',
		stats: {
			age: {
				max: true
			}
		}
	},
	bar: {
		type: 'stats',
		stats: {
			age: {
				max: true
			}
		}
	}
}).then(function(resultMap) {
	// resultMap.foo = { total: 200, ... }
	// resultMap.bar = [ { key: ... }, ... ]
});
```

### remove(query[, options])

Remove a list of documents from the database that match the given query.  All options
are model-specific.

```js
animals.remove({ animalType: 'dog' }).then(function(numRemoved) { ... })
```

### update(query, update[, options])

Performs an update operation on all documents in the database that match a query.
The update expression given is a CommonQuery syntax update.

Options may include:

- `allowFullReplace` - By default, if the update expression doesn't contain any operators (starting with `$`),
the whole object is implicitly wrapped in a `$set` instead of replacing the entire document.
If `allowFullReplace` is set to true, this behavior is disabled.

```js
animals.update({
	name: 'Toby'
}, {
	$inc: { age: 1 }
}).then(function(numUpdated) { ... });
```

### insert(data[, options])

Inserts a document directly into the database without constructing the `Document` object.

```js
animals.insert({
	animalType: 'cat',
	name: 'Toby',
	age: 5,
	...
}).then(function() { ... });
```

### upsert(query, update[, options])

Performs an update operation on all documents in the database that match a query, creating a document if none exist.
The update expression given is a CommonQuery syntax update.
The default implementation is to call `#insert` when there are no matching documents, and `#update` if there are.
Accepts the same options as `#update`.

```js
animals.upsert({
	name: 'Toby'
}, {
	$inc: { age: 1 }
}).then(function(numUpdated) { ... });
```


## Document

A document represents a single object in the datastore.  It should not be constructed
directly (except by the model implementation).  Instead, create new documents using
`model.create()` .

Methods are:

### getData()

Unlike model systems like mongoose, data on documents is not stored directly on the Document
object.  To get the object that contains the document data, call `getData()` on the document.
The returned object is both readable and mutable.

```js
var animalData = animal.getData();
```

### getModel()

Returns the model instance that created the document.

### save()

Saves the current document data.

```js
animal.save().then(function() { ... })
```

### remove()

Remove the document from the datastore.

```js
animal.remove().then(function() { ... })
```

## Hooks

Like mongoose, unimodel models have hooks that are registered on the model and are executed
when various document actions are performed.  Hooks are implemented by `crisphooks` and are
registered like this:

```js
animalModel.hook('pre-save', function(animal) {
	animal.age++;
	// Can optionally return a promise
});
```

Models can add their own hook types.  Defined hooks are:

- `post-init` - A synchronous-only hook that executes after a document object is constructed.
  It takes a parameter of the document, and `this` points to the model.
- `pre-save` - Executes before the document is saved.  It takes a parameter of the document,
  and `this` points to the model.
- `post-save` - Executes after the document is saved, before `save()` returns.  It takes a
  parameter of the document, and `this` points to the model.
- `pre-remove` - Executes before the document is removed.
- `post-remove` - Executes after the document is removed.

## Schema-based Models

Unimodel also contains additional base classes for schema-based abstract models.  These inherit
from the normal base classes.

## SchemaModel

`SchemaModel` contains all the methods of `Model` along with the following additions:

### constructor(schema[, options])

The constructor takes a CommonSchema `Schema` object in addition to its normal options.  Options
can additionally contain anything that `Schema#normalize()` accepts.

### getSchema()

Returns the CommonSchema `Schema`.

### getKeys()

Returns an array of all fields in the schema marked with `{ key: true }`.  This flag indicates that
the field is part of a key used to identify the document.

For example, given this schema

```js
{
	foo: { type: String, key: true },
	bar: { type: Date, key: true },
	baz: Number
}
```

`getKeys()` will return `[ 'foo', 'bar' ]` .

### normalizeQuery(query[, options])

Given a CommonQuery `Query` object, normalizes it according to the model's schema.  Options can
contain anything `Query#normalize()` accepts.  The query passed in can also be a plain object,
in which case it's converted to a `Query`.  Returns the normalized `Query` object.

### normalizeUpdate(update[, options])

Same thing as `normalizeQuery()` but for CommonQuery updates.

### normalizeAggregate(aggregate[, options])

Same thing as `normalizeQuery()` but for CommonQuery aggregates.


## SchemaDocument

### normalize([options])

Normalizes the document data according to the model's schema, in-place.  Also executes the
`pre-normalize` and `post-normalize` hooks.  Normally this should be called from the implementing
class's `save()` method.

This `normalize()` method returns a promise as hooks can execute asynchronously.


## Aggregates

See the [aggregates section in common-query](https://git.zipscene.com/zsapilibs/common-query#aggregates)
for details.


## Miscellaneous methods

You can use `Model.isModel` to test whether a given value is a model instance.

```js
Model.isModel(new Model());
// => true

Model.isModel('bar');
// => false
```


## Quirks

- The default implementation of `Model#upsert` provided does not work with `Array` paths.
  It is recommended to override the `Model#upsert` method if something more robust is desired.
