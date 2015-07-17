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
- An `animalModel` instance of MongoModel which includes the schema and collection name of animals.
- A `MongoDocument` document class which is used to instantiate Mongo objects.
- Multiple `animal` objects which are instances of `MongoDocument`, created using `animalModel.create()`.

Here's another example where the model is not on top of a generic database, but is instead on top
of a specific API (say, Twitter).

- A `TweetModel` model class which creates tweet models.
- A `tweetModel` model, containing `find()`, `create()`, etc.
- A `TweetDocument` document class which is used to instantiate Tweet documents.
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

### aggregate(query, aggregate[, options])

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
	aggregateType: 'stats',
	// Execute statistics on the 'age' field
	statsField: 'age',
	// Return the total number of documents the aggregate is executed across
	total: true,
	// Return the number of documents which have a non-null 'age' field
	count: true,
	// Return the average age
	avg: true,
	// Return the maximum age
	max: true
}
```

A result set for this aggregate would look something like:

```js
{
	// There are 400 animals matched by the query
	total: 400,
	age: {
		// Of those, 329 have non-null 'age' fields
		count: 329,
		// The average age of animals in 5.2382
		avg: 5.2382,
		// The maximum age of animals is 19.2
		max: 19.2
	}
}
```

The different types of stats you can ask for are:

- total - The total number of documents matched by the aggregate query.  This stat appears
  outside of the field blocks.
- count - The number of documents that contain a non-null value for statsField.
- avg - The average value statsField.
- min - The minimum value of statsField.
- max - The maximum value of statsField.

Not all model types need support all of these types of stats, and model types may add
additional stats if they are supported.

You can also supply more than one statsField in the aggregate:

```js
{
	aggregateType: 'stats',
	statsField: [ 'age', 'dateFound' ],
	max: true
}
```

Results might look like this:

```js
{
	age: {
		max: 19.2
	},
	dateFound: {
		max: '2015-04-12T07:22:09Z'
	}
}
```

### Group by Discrete Values of Field

This type of aggregate will return statistics grouped by different values of a field.

```js
{
	// Group by field values
	aggregateType: 'group',
	// The field to group by is 'animalType'
	groupBy: {
		field: 'animalType'
	},
	// Perform statistics within each group on the 'age' field
	statsField: 'age',
	// Return the average age
	avg: true,
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
		// One entry for each statsField with the requested stats
		age: {
			// Average age of cats
			avg: 7.2
		},
		// There are 18 cats in the database (note that this is outside the field stats blocks)
		total: 18
	},
	{
		key: [ 'dog' ],
		age: {
			avg: 6.4
		},
		total: 12
	},
	{
		key: [ 'bird' ],
		age: {
			avg: 2.1
		},
		total: 4
	}
]
```

You can also leave off `statsField` to get only totals:

```js
{
	aggregateType: 'group',
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
	aggregateType: 'group',
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
	// Note that you can also supply statsField and stats flags here as well
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
	aggregateType: 'group',
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

### Group by Fixed Sized Intervals

```js
{
	aggregateType: 'group',
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
	aggregateType: 'group',
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
	aggregateType: 'group',
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
	aggregateType: 'group',
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
		key: '2012-01-01T00:00:00Z',
		total: 1
	},
	{
		key: '2012-01-03T00:00:00Z',
		total: 2
	},
	{
		key: '2012-01-05T00:00:00Z',
		total: 2
	},
	...
]
```

Note that this does NOT represent a duration.  The last interval in the range of a time
component may be cut short (for example, in months with 31 days, the last interval in
the above example would be only a single day instead of 2 days).

The "base" value for a time component is always the first valid point in time for that component.

### Grouping By Multiple Fields

The `groupBy` parameter can contain an array of grouping specifiers.  In this case, each combination
of values is considered a group.

```js
{
	aggregateType: 'group',
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


