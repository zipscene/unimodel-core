# zs-unimodel

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
const Model = require('zs-unimodel').Model;
```

These methods are:

### constructor()

The constructor takes no options by default.  Child classes may add options (for example, the Mongo
model above would take a schema and collection name as constructor parameters).

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

Performs an update operation on all documents in the database that match a query.  The update
expression given is a CommonQuery syntax update.

Options can include:

- `allowFullReplace` - By default, if the update expression doesn't contain any operators (starting
with `$`), the whole object is implicitly wrapped in a `$set` instead of replacing the entire
document.  If `allowFullReplace` is set to true, this behavior is disabled.

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

## Aggregates

Unimodel aggregates are specified in a common format that has no analog (that I know of)
in existing systems.  The best way to understand them is by example.  Examples in this
section use documents representing pets at animal shelters:

```js
{
	animalType: 'dog',
	animalSubtype: 'Yorkshire Terrier',
	age: 4,
	weight: 14.2,
	shelterLocation: 'Clifton',
	dateFound: '2013-03-20T04:13:23Z',
	name: 'Ruff'
}
```

### Collection-Wide Statistics

This aggregate type returns statistics on a field across a whole collection (or a subset
matched by a query).

```js
{
	// Statistics across the whole collection
	type: 'stats',
	// Perform statistics on a field
	stats: {
		age: {
			count: true,
			avg: true,
			max: true
		}
	},
	// Return the total number of documents the aggregate is executed across
	total: true
}
```

A result set for this aggregate would look something like:

```js
{
	// There are 400 animals matched by the query
	total: 400,
	stats: {
		age: {
			// Of those, 329 have non-null 'age' fields
			count: 329,
			// The average age of animals in 5.2382
			avg: 5.2382,
			// The maximum age of animals is 19.2
			max: 19.2
		}
	}
}
```

The different types of stats you can ask for are:

- count - The number of documents that contain a non-null value for the field.
- avg - The average value of the field.
- min - The minimum value of the field.
- max - The maximum value of the field.

Not all model types need support all of these types of stats, and model types may add
additional stats if they are supported.

You can also supply more than one stats field in the aggregate:

```js
{
	type: 'stats',
	stats: {
		age: {
			max: true
		},
		dateFound: {
			min: true
		}
	}
}
```

Results might look like this:

```js
{
	stats: {
		age: {
			max: 19.2
		},
		dateFound: {
			min: '2015-04-12T07:22:09Z'
		}
	}
}
```

For convenience, `stats` can be a single string.  In this case, the string is treated as
a field name, and the `count` stat is executed on it:

```js
{
	type: 'stats',
	stats: 'animalType'
}
```

is converted to:

```js
{
	type: 'stats',
	stats: {
		animalType: {
			count: true
		}
	}
}
```

### Group by Discrete Values of Field

This type of aggregate will return statistics grouped by different values of a field.

```js
{
	// Group by field values
	type: 'group',
	// The field to group by is 'animalType'
	groupBy: {
		field: 'animalType'
	},
	// Perform statistics within each group on the 'age' field
	stats: {
		age: {
			avg: true
		}
	},
	// Return the total number of documents in each group
	total: true
}
```

Results look like:

```js
[
	{
		// The value of the groupBy field (see below for why this is an array)
		key: [ 'cat' ],
		// Requested statistics for this grouping
		stats: {
			age: {
				// Average age of cats
				avg: 7.2
			}
		},
		// There are 18 cats in the database (note that this is outside the field stats blocks)
		total: 18
	},
	{
		key: [ 'dog' ],
		stats: {
			age: {
				avg: 6.4
			}
		},
		total: 12
	},
	{
		key: [ 'bird' ],
		stats: {
			age: {
				avg: 2.1
			}
		},
		total: 4
	}
]
```

As a shorthand, you can specify a string as `groupBy`:

```js
{
	groupBy: 'animalType'
}
```

is converted to:

```js
{
	groupBy: [ {
		field: 'animalType'
	} ]
}
```

You can also leave off `stats` to get only totals:

```js
{
	type: 'group',
	groupBy: { field: 'animalType' },
	total: true
}
```

May yield:

```js
[
	{
		key: [ 'cat' ],
		total: 18
	},
	{
		key: [ 'dog' ],
		total: 12
	},
	{
		key: [ 'bird' ],
		total: 4
	}
]
```


### Group by Ranges of a Field Value

This will group by ranges of a numeric field.

```js
{
	type: 'group',
	groupBy: {
		// Continuously-valued field to group by
		field: 'age',
		ranges: [
			// First group (group 0) is animals less than 1 year old
			{ end: 1 },
			// Second group (group 1) is animals 1-3 years old
			{ start: 1, end: 3 },
			// Third group (group 2) is animals 3-9 years old
			{ start: 3, end: 9 },
			// Fourth group (group 3) is animals more than 9 years old
			{ start: 9 }
		]
	},
	// Give total matching for each group
	// Note that you can also supply stats here as well
	total: true
}
```

Results look like this:

```js
[
	{
		// This is the entry for group number 0
		// These indices correspond to the indices in the given ranges array
		key: [ 0 ],
		// There are 5 animals in this range (less than 1 year old)
		total: 5
	},
	{
		key: [ 1 ],
		total: 8
	},
	{
		key: [ 2 ],
		total: 14
	},
	{
		key [ 3 ],
		total: 7
	}
]
```

These ranges can also be dates if applied to a date field:

```js
{
	type: 'group',
	groupBy: {
		field: 'dateFound',
		ranges: [
			{ end: '2010-01-01T00:00:00Z' },
			{ start: '2010-01-01T00:00:00Z', end: '2013-01-01T00:00:00Z' },
			{ start: '2013-01-01T00:00:00Z' }
		]
	},
	total: true
}
```

For convenience, a continuous series of non-overlapping ranges can be specified as:

```js
{
	type: 'group',
	groupBy: {
		field: 'age',
		ranges: [ 1, 3, 9 ]
	},
	total: true
}
```

The output of this is:

```js
[
	{
		// This key corresponds to the range ENDING at index 0 (ie, all animals less than 1 year old)
		key: [ 0 ],
		// There are 5 animals in this range (less than 1 year old)
		total: 5
	},
	{
		// Range from 1-3 years
		key: [ 1 ],
		total: 8
	},
	{
		// Range from 3-9 years
		key: [ 2 ],
		total: 14
	},
	{
		// One more result entry than entries in the array
		// This is for animals more than 9 years old
		key [ 3 ],
		total: 7
	}
]
```

### Group by Fixed Sized Intervals

```js
{
	type: 'group',
	groupBy: {
		// Segment the numeric field 'age'
		field: 'age',
		// Each interval is of length 3
		interval: 3,
		// By default, intervals start at 0 (ie, -3, 0, 3, 6, 9, etc)
		// This supplies a different offset
		// When set to 1, the intervals become -2, 1, 4, 7, etc
		base: 1
	},
	total: true
}
```

Results look like this:

```js
[
	{
		// The key here is the start value of the interval
		// Ie, this entry is for the interval -2 through 1
		key: [ -2 ],
		total: 5
	},
	{
		// This is for the interval 1 through 4
		key: [ 1 ],
		total: 4
	},
	{
		key: [ 4 ],
		total: 8
	},
	...
]
```

These can also be applied to dates.  In this case, the interval should be supplied as an
ISO 8601 time Duration.  For example, an interval of 'P3H15M' is an interval of 15 minutes.

```js
{
	type: 'group',
	groupBy: {
		field: 'dateFound',
		interval: 'P8H',
		// The default base when using time intervals is not defined.
		// Override bases are specified as an ISO8601 timestamp.
		base: '2010-01-01T00:00:00Z'
	},
	total: true
}
```

Results in:

```js
[
	{
		// Result keys are ISO timestamps
		key: [ '2010-01-01T00:00:00Z' ],
		total: 2
	},
	{
		key: [ '2010-01-01T08:00:00Z' ],
		total: 1
	},
	...
]
```

### Group by Time Components

Usually, when you want to group by (for example) month, you don't actually want to use a time
interval of 30 days because these won't align with month boundaries.  This grouping type allows
you to group by time components.

```js
{
	type: 'group',
	groupBy: {
		// Field to group by
		field: 'dateFound',
		// Time component to group into
		timeComponent: 'year',
		// The number of time components in each group (optional)
		timeComponentCount: 1
	},
	total: true
}
```

The output looks like:

```js
[
	{
		key: [ '2012-01-01T00:00:00Z' ],
		total: 4
	},
	{
		key: [ '2013-01-01T00:00:00Z' ],
		total: 7
	},
	{
		key: [ '2014-01-01T00:00:00Z' ],
		total: 5
	},
	...
]
```

Each of the result keys is an ISO8601 timestamp corresponding to the start of the range
represented by that time component.

The `timeComponent` field can be one of the following:

- `year`
- `month`
- `week`
- `day`
- `hour`
- `minute`
- `second`

The `timeComponentCount` field is optional, and can be used to create longer intervals.

```js
{
	type: 'group',
	groupBy: {
		field: 'dateFound',
		timeComponent: 'day',
		timeComponentCount: 2
	},
	total: true
}
```

Can result in:

```js
[
	{
		key: [ '2012-01-01T00:00:00Z' ],
		total: 1
	},
	{
		key: [ '2012-01-03T00:00:00Z' ],
		total: 2
	},
	{
		key: [ '2012-01-05T00:00:00Z' ],
		total: 2
	},
	...
]
```

Note that this does NOT represent a duration.  The last interval in the range of a time
component may be cut short (for example, in months with 31 days, the last interval in
the above example would be only a single day instead of 2 days).

The "base" value for a time component is always the first valid point in time for that component.
For `year`, the base point in time used is year 1.

### Grouping By Multiple Fields

The `groupBy` parameter can contain an array of grouping specifiers.  In this case, each combination
of values is considered a group.

```js
{
	type: 'group',
	groupBy: [
		{
			field: 'animalType'
		},
		{
			field: 'age',
			interval: 4
		}
	],
	total: true
}
```

This groups by age (in intervals of 4) and animalType.  The results for this look like:

```js
[
	{
		key: [ 'dog', 0 ],
		total: 2
	},
	{
		key: [ 'dog', 4 ],
		total: 3
	},
	{
		key: [ 'dog', 8 ],
		total: 2
	},
	{
		key: [ 'cat', 0 ],
		total: 5
	},
	{
		key: [ 'cat', 4 ],
		total: 3
	},
	...
]
```


