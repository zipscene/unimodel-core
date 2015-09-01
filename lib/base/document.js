const XError = require('xerror');

/**
 * This class is the superclass of all unimodel document objects.
 * It should not be instantiated directly, but should be subclassed,
 * and the subclass should be instantiated by `model.create()` .
 *
 * @class Document
 * @constructor
 * @param {Model} model - The instantiated model that created this Document
 * @param {Object} data - The initial data to fill this document with
 */
class Document {

	constructor(model, data) {
		this.model = model;
		this.data = data;
	}

	/**
	 * Returns the mutable data object that backs this document.
	 *
	 * @method getData
	 * @since v0.0.1
	 * @return {Object} - Mutable data object
	 */
	getData() {
		return this.data;
	}

	/**
	 * Returns the model object that instantiated this document.
	 *
	 * @method getModel
	 * @since v0.0.1
	 * @return {Model}
	 */
	getModel() {
		return this.model;
	}

	/**
	 * Saves the current model data to the datastore.
	 * This also calls the `pre-save` and `post-save` hooks.
	 *
	 * @method save
	 * @since v0.0.1
	 * @return {Promise} - Resolves with `this` or rejects with `XError` when complete.
	 */
	save() {
		throw new XError(XError.UNSUPPORTED_OPERATION, 'The save() method is not implemented for this model');
	}

	/**
	 * Removes the current model from the datastore.  This also calls the `pre-remove` and
	 * `post-remove` hooks.
	 *
	 * @method remove
	 * @since v0.0.1
	 * @return {Promise} - Resolves with `this` or rejects with `XError`.
	 */
	remove() {
		throw new XError(XError.UNSUPPORTED_OPERATION, 'The remove() method is not implemented for this model');
	}

}

module.exports = Document;
