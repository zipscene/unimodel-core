const XError = require('XError');

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
 */
class Model {

	constructor() {
	}

	/**
	 * Executes a mongo-style query.
	 *
	 * @method find
	 * @param {Object} query - Mongo-style query to execute
	 * @param {Object} options - Additional options
	 *   @param {Number} options.skip - Number of documents to skip when returning results
	 *   @param {Number} options.limit - Maximum number of results to return
	 *   @param {String[]} options.fields - Array of dot-separated field names to return
	 *   @param {Boolean} options.total - If true, also return a field with total number of results
	 * @return {Promise} - Resolves with an array of result documents.  Rejects with an XError.
	 *   If the option `total` was set to true, the array also contains an additional member called
	 *   `total` containing the total number of results without skip or limit.
	 */
	find(query, options = {}) {
		if (this.findStream !== Model.prototype.findStream) {
			let stream = this.findStream(query, options);
			return stream.intoArray().then(function(array) {
				if (options.total) {
					return stream.getTotal().then(function(total) {
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
	 * @param {Object} query
	 * @param {Object} options - See the options for `find()`
	 * @return {DocumentStream} - A readable object stream streaming document instances.  The stream
	 *   also contains a method called `getTotal()`, which returns a promise resolving to the total
	 *   number of results.
	 */
	findStream(query, options = {}) {

	}

	/**
	 * Finds a single object matching a query.
	 *
	 * @param {Object} query
	 * @param {Object} options - See the options for `find()`.  Options `total` and `limit` are not
	 *   supported.
	 * @return {Promise} - Resolves with the single document instance.  On error, rejects with an
	 *   XError.  On not found, rejects with an XError with the code `XError.NOT_FOUND` .
	 */
	findOne(query, options = {}) {
		throw new XError(XError.UNSUPPORTED_OPERATION, 'The findOne() method is not implemented for this model');
	}

	findByKeys() {

	}

}
