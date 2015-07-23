const Model = require('../base/model');
const createSchema = require('zs-common-schema').createSchema;
const createQuery = require('zs-common-query').createQuery;
const _ = require('lodash');
const objtools = require('zs-objtools');

/**
 * A SchemaModel is an abstract class on top of Model that implements handling of
 * abstract models with a common-schema schema.
 *
 * @class SchemaModel
 * @constructor
 * @param {Schema|Object} schema - A common-schema Schema object, or a plain object that
 *   is transformed into a schema.
 * @param {Object} [options] - Additional options.
 *   @param {Boolean} options.allowUnknownFields - If set to true, fields present on documents but
 *     not present in the schema are allowed.  This defaults to false.
 */
class SchemaModel extends Model {

	constructor(schema, options = {}) {
		// Initialize superconstructor
		super(options);

		// Turn any plain objects into a normalized schema
		if (_.isPlainObject(schema)) {
			schema = createSchema(schema);
		}
		this.schema = schema;

		// Figure out which subschemas have the "key" flag set
		let keyFields = [];
		schema.traverseSchema({
			onSubschema(subschema, path) {
				if (subschema.key) {
					keyFields.push(path);
				}
			}
		});
		this._documentKeyFields = keyFields;
	}

	/**
	 * Returns the schema associated with this model.
	 *
	 * @method getSchema
	 * @return {Schema}
	 */
	getSchema() {
		return this.schema;
	}

	/**
	 * Returns the keys for the documents based on which fields in the schema are marked
	 * with the `{ key: true }` flag.
	 *
	 * @return {String[]}
	 */
	getKeys() {
		return this._documentKeyFields;
	}

	/**
	 * Normalizes and validates the query that is passed in.
	 *
	 * @method normalizeQuery
	 * @param {Query|Object} query - Query to normalize
	 * @param {Object} [options] - Additional options to pass to the common-query normalizer
	 * @return {Query} - The query object after normalization
	 */
	normalizeQuery(query, options = {}) {
		let normalizeOptions = objtools.merge(
			{},
			this.modelOptions || {},
			options,
			{ schema: this.schema }
		);
		if (_.isPlainObject(query)) {
			query = createQuery(query, normalizeOptions);
		} else {
			query.normalize(normalizeOptions);
		}
		return query;
	}

	/**
	 * Normalizes and validates the update expression passed in.
	 *
	 * @method normalizeUpdate
	 * @param {Update|Object} update - The update expression
	 * @param {Object} [options] - Additional options to pass to the common-query normalizer
	 * @return {Update} - The update object after normalization
	 */
	normalizeUpdate(update, options = {}) {

	}

	/**
	 * Normalizes and validates the aggregate spec passed in.
	 *
	 * @method normalizeAggregate
	 * @param {Aggregate|Object} update - The aggregate spec
	 * @param {Object} [options] - Additional options to pass to the common-query normalizer
	 * @return {Aggregate} - The aggregate object after normalization
	 */
	normalizeAggregate(aggregate, options = {}) {

	}

}

module.exports = SchemaModel;
