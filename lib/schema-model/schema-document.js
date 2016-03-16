const Document = require('../base/document');
const objtools = require('zs-objtools');

/**
 * This document class adds schema-handling capabilities to the base document.
 *
 * @class SchemaDocument
 * @constructor
 * @param {Model} model - The model that created this document
 * @param {Object} [data] - Optional encapsulated data
 */
class SchemaDocument extends Document {

	constructor(model, data) {
		super(model, data);
		this._normalizeData();
	}

	/**
	 * Synchronously normalize the data in this document according to the schema, without
	 * triggering normalize or validate hooks.
	 *
	 * @method _normalizeData
	 * @protected
	 * @param {Object} [options] - Additional options to pass to the normalizer
	 * @return {Object} - this.data
	 */
	_normalizeData(options = {}) {
		let model = this.getModel();
		let normalizeOptions = objtools.merge(
			{},
			model.modelOptions.normalize || {},
			options
		);
		this.data = model.getSchema().normalize(this.getData(), normalizeOptions);
		return this.data;
	}

	/**
	 * Normalizes and validates the data contained in this document.  Also calls the normalization hooks
	 * `pre-normalize` and `post-normalize`.
	 *
	 * @method normalize
	 * @since v0.0.1
	 * @throws ValidationError
	 * @param {Object} [options] - Additional options to pass to the normalizer
	 * @return {Promise} - Resolves when normalization is complete
	 */
	normalize(options = {}) {
		let model = this.getModel();
		return model.trigger('pre-validate', this)
			.then(() => model.trigger('post-validate', this))
			.then(() => model.trigger('pre-normalize', this))
			.then(() => this._normalizeData(options))
			.then(() => model.trigger('post-normalize', this))
			.then(() => this);
	}

}

module.exports = SchemaDocument;
