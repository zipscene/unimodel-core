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
	}

	/**
	 * Normalizes and validates the data contained in this document.  Also calls the normalization hooks
	 * `pre-normalize` and `post-normalize`.
	 *
	 * @method normalize
	 * @throws ValidationError
	 * @param {Object} [options] - Additional options to pass to the normalizer
	 * @return {Promise} - Resolves when normalization is complete
	 */
	normalize(options = {}) {
		let model = this.getModel();
		let normalizeOptions = objtools.merge(
			{},
			model.modelOptions.normalize || {},
			options
		);
		return model.trigger('pre-validate', this)
			.then(() => model.trigger('post-validate', this))
			.then(() => model.trigger('pre-normalize', this))
			.then(() => {
				this.data = model.getSchema().normalize(this.getData(), normalizeOptions);
			})
			.then(() => model.trigger('post-normalize', this))
			.then(() => this);
	}

}

module.exports = SchemaDocument;
