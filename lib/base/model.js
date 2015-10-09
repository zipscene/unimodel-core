const _ = require('lodash');
const pasync = require('pasync');
const XError = require('xerror');
const { CrispPrePostHooks } = require('crisphooks');
const { createQuery, createUpdate } = require('zs-common-query');
const FakeDocumentStream = require('./fake-document-stream');

/**
 * This is the parent class for unimodel models.  A model is the class that contains
 * methods that apply to collection-wide operations.
 *
 * A model is NOT a document.  A document is one instance of a model that contains
 * attributes.  Models can create documents and query documents, but the documents
 * themselves have their own set of methods.
 *
 * By convention, subclasses of Model should be named <Name>Model, and their document
 * classes should just be named <Name>.  For example, the model that represents a
 * collection of animals would be called `AnimalModel`, and the document would be
 * called `Animal`.
 *
 * This is an abstract class and does not provide any functionality.  It must be extended
 * by child classes.
 *
 * @class Model
 * @constructor
 * @param {Object} [options] - Options modifying behavior of the model.  These are defined
 *   by the model implementor.
 */
class Model extends CrispPrePostHooks {

	constructor(options = {}) {
		super();
		this.modelOptions = options;
	}

	/**
	 * A duck-type tests for whether a value is a Model instance
	 *
	 * @method isModel
	 * @static
	 * @param {*} value - Value to test
	 * @return {Boolean}
	 * @since v0.1.0
	 */
	static isModel(value) {
		return (
			_.isObject(value) &&
			_.isFunction(value.getName) &&
			_.isFunction(value.getKeys) &&
			_.isFunction(value.getType) &&
			_.isFunction(value.find) &&
			_.isFunction(value.findStream) &&
			_.isFunction(value.findOne) &&
			_.isFunction(value.aggregate) &&
			_.isFunction(value.aggregateMulti) &&
			_.isFunction(value.create) &&
			_.isFunction(value.remove) &&
			_.isFunction(value.update) &&
			_.isFunction(value.insert) &&
			_.isFunction(value.insertMulti)
		);
	}

	/**
	 * Returns a name that is used to reference this model/collection.  It should be uppercase and pluralized.
	 *
	 * @method getName
	 * @since v0.0.1
	 * @return {String} - Name for the model
	 */
	getName() {
		throw new XError(XError.UNSUPPORTED_OPERATION, 'The getName() method is not implemented for this model');
	}

	/**
	 * Returns a list of key fields used to uniquely identify documents in this collection.
	 * Keys should be listed in order from most-specific to least-specific.
	 *
	 * @example
	 *   In a collection of cities, the keys might be: `[ 'cityName', 'state', 'country', 'planet' ]`.
	 *
	 * @method getKeys
	 * @since v0.0.1
	 * @return {Array{String}} - Array of field names
	 */
	getKeys() {
		throw new XError(XError.UNSUPPORTED_OPERATION, 'The getKeys() method is not implemented for this model');
	}

	/**
	 * Get the model type, which is typically simply the constructor name.
	 *
	 * @example 'UnimongoModel'
	 * @example 'ElasticsearchModel'
	 *
	 * @method getType
	 * @since v0.1.0
	 * @return {String} - Model type
	 */
	getType() {
		return this.constructor.name;
	}

	/**
	 * Executes a mongo-style query.
	 *
	 * @method find
	 * @since v0.0.1
	 * @param {Object} query - Mongo-style query to execute
	 * @param {Object} [options] - Additional options
	 *   @param {Number} options.skip - Number of documents to skip when returning results
	 *   @param {Number} options.limit - Maximum number of results to return
	 *   @param {Array{String}} options.fields - Array of dot-separated field names to return
	 *   @param {Boolean} options.total - If true, also return a field with total number of results
	 *   @param {Array{String}} options.sort - An array of field names to sort by.  Each field can be
	 *     prefixed by a '-' to sort in reverse.
	 * @return {Promise} - Resolves with an array of result documents.  Rejects with an XError.
	 *   If the option `total` was set to true, the array also contains an additional member called
	 *   `total` containing the total number of results without skip or limit.
	 */
	find(query, options = {}) {
		// As a default implementation, check if the streaming query is overridden, and if so,
		// use it to find the documents.
		if (this.findStream !== Model.prototype.findStream) {
			let stream = this.findStream(query, options);
			return stream.intoArray().then((array) => {
				// If a total was requested, fetch that from the DocumentStream's method
				if (options.total) {
					return stream.getTotal().then((total) => {
						array.total = total;
						return total;
					});
				} else {
					return array;
				}
			});
		} else {
			throw new XError(XError.UNSUPPORTED_OPERATION, 'The find() method is not implemented for this model');
		}
	}

	/**
	 * Performs a streaming query.
	 *
	 * @method findStream
	 * @since v0.0.1
	 * @param {Object} query
	 * @param {Object} [options] - See the options for `find()`
	 * @return {DocumentStream} - A readable object stream streaming document instances.  The stream
	 *   also contains a method called `getTotal()`, which returns a promise resolving to the total
	 *   number of results.
	 */
	findStream(query, options = {}) {
		// By default, instantate a fake document stream that uses find() to fetch a static
		// array, and stream it as if it were an actual stream.
		return new FakeDocumentStream(this, query, options);
	}

	/**
	 * Finds a single object matching a query.
	 *
	 * @method findOne
	 * @since v0.0.1
	 * @param {Object} query
	 * @param {Object} [options] - See the options for `find()`.  Options `total` and `limit` are not
	 *   supported.
	 * @return {Promise} - Resolves with the single document instance.  On error, rejects with an
	 *   XError.  On not found, rejects with an XError with the code `XError.NOT_FOUND` .
	 */
	findOne(/*query, options = {}*/) {
		throw new XError(XError.UNSUPPORTED_OPERATION, 'The findOne() method is not implemented for this model');
	}

	/**
	 * Returns a count of the number of documents matching a query.
	 *
	 * @method count
	 * @since v0.0.1
	 * @param {Object} query
	 * @param {Object} [options] - See options for `find()`.
	 * @return {Promise} - Resolves with the numeric count.  Rejects with an XError.
	 */
	count(query, options = {}) {
		options.total = true;
		return this.find(query, options)
			.then((results) => {
				if (results.total !== undefined) {
					return results.total;
				} else {
					throw new XError(
						XError.UNSUPPORTED_OPERATION,
						'The count() method is not implemented for this model'
					);
				}
			});
	}

	/**
	 * Executes the aggregate and returns the results.
	 *
	 * @method aggregate
	 * @since v0.0.1
	 * @param {Object} query - Filter to restrict aggregates to
	 * @param {Object} aggregate - A map from aggregate names to aggregate specs. See the
	 *   README for details.
	 * @param {Object} [options] - Additional options to pass to the aggregate.
	 *   @param {Number} options.limit - Maximum number of aggregate entries to return.
	 *   @param {Array{String}} options.sort - Fields to sort the results by.  These are field paths that
	 *     reference the aggregate result entries (ie, `foo.avg`).
	 * @return {Promise} - Resolves with a map from aggregate names (as in the aggregates parameter)
	 *   to aggregate result objects.
	 */
	aggregate(query, aggregate, options = {}) {
		if (this.aggregateMulti !== Model.prototype.aggregateMulti) {
			return this.aggregateMulti(query, { aggregate }, options).then( (results) => results.aggregate );
		} else {
			throw new XError(XError.UNSUPPORTED_OPERATION, 'The aggregate() method is not implemented for this model');
		}
	}

	/**
	 * Executes the aggregates and returns the results.
	 *
	 * @method aggregateMulti
	 * @since v0.0.1
	 * @param {Object} query - Filter to restrict aggregates to
	 * @param {Object} aggregates - A map from aggregate names to aggregate specs. See the
	 *   README for details.
	 * @param {Object} [options] - Additional options to pass to the aggregate. These
	 *   are model-specific.
	 * @return {Promise} - Resolves with a map from aggregate names (as in the aggregates parameter)
	 *   to aggregate result objects.
	 */
	aggregateMulti(query, aggregates, options = {}) {
		if (this.aggregate !== Model.prototype.aggregate) {
			let resultsMap = {};
			return pasync.eachSeries(_.keys(aggregates), (aggregateKey) => {
				return this.aggregate(query, aggregates[aggregateKey], options).then( (results) => {
					resultsMap[aggregateKey] = results;
				} );
			} ).then( () => resultsMap );
		} else {
			throw new XError(XError.UNSUPPORTED_OPERATION, 'The aggregate() method is not implemented for this model');
		}
	}

	// TODO: Add aggregateStream() method and corresponding default implementations

	/**
	 * Creates a new instance of the Document this model represents.  The new document is not
	 * immediately saved to the datastore.
	 *
	 * @method create
	 * @since v0.0.1
	 * @param {Object} [data] - Initial data to fill the newly created document with.
	 * @return {Document} - An instance of this model's Document
	 */
	create(/*data = {}*/) {
		throw new XError(XError.UNSUPPORTED_OPERATION, 'The create() method is not implemented for this model');
	}

	/**
	 * Removes all documents matching the given query.
	 *
	 * @method remove
	 * @since v0.0.1
	 * @param {Object} query - Query to match documents to remove.
	 * @param {Object} [options] - Model-dependent options
	 * @return {Promise} - Promise that resolves with the number of documents removed, or rejects with XError
	 */
	remove(query/*, options = {}*/) {
		return this.findStream(query).intoArray()
			.then((documents) => {
				let promises = documents.map((document) => document.remove());
				return Promise.all(promises);
			});
	}

	/**
	 * Updates all documents matching a given query.
	 *
	 * @method update
	 * @since v0.0.1
	 * @param {Object} query - The query to match documents
	 * @param {Object} update - The Mongo-style update expression used to update documents.
	 *   By default, if this object contains no keys beginning with '$',
	 *   the update expression is implicitly wrapped in a '$set'.
	 * @param {Object} [options={}]
	 *   @param {Boolean} options.allowFullReplace - If this is set to true, update expressions
	 *     that do not contain any operators are allowed, and result in complete replacement of
	 *     any matching documents.
	 * @return {Promise} - Resolves with the number of documents updated, or rejects with XError
	 */
	update(query, update, options = {}) {
		if (_.isPlainObject(update)) update = createUpdate(update, options);

		return this.findStream(query).intoArray()
			.then((documents) => {
				let promises = documents.map((document) => {
					update.apply(document);
					return document.save();
				});

				return Promise.all(promises);
			});
	}

	/**
	 * Inserts a new document directly into the database.
	 *
	 * @method insert
	 * @since v0.0.1
	 * @param {Object} data - The data to insert as the document.
	 * @param {Object} [options] - Model-specific options.
	 * @return {Promise} - Resolves with undefined or rejects with XError.
	 *   NOTE: can optionally return with the inserted document, if it is not any extra work to construct
	 */
	insert(data, options = {}) {
		if (this.insertMulti === Model.prototype.insertMulti) {
			let msg = 'The insert() method is not implemented for this model';
			throw new XError(XError.UNSUPPORTED_OPERATION, msg);
		}
		return this.insertMulti([ data ], options);
	}

	/**
	 * Insert multiple documents into the database.
	 *
	 * @method insertMulti
	 * @since v0.0.1
	 * @param {Array{Object}} datas - The data to insert as the document.
	 * @param {Object} [options] - Model-specific options.
	 * @return {Promise} - Resolves with undefined or rejects with XError.
	 *   NOTE: can optionally return with the inserted documents, if it is not any extra work to construct
	 */
	insertMulti(datas, options = {}) {
		if (this.insert === Model.prototype.insert) {
			let msg = 'The insertMulti() method is not implemented for this model';
			throw new XError(XError.UNSUPPORTED_OPERATION, msg);
		}
		return pasync.each(datas, (data) => this.insert(data, options));
	}

}

module.exports = Model;
