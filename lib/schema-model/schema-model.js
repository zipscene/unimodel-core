// Copyright 2016 Zipscene, LLC
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0

const Model = require('../base/model');
const createSchema = require('common-schema').createSchema;
const { createQuery, createUpdate, createAggregate } = require('common-query');
const _ = require('lodash');
const objtools = require('objtools');

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

		this._setSchema(schema);
	}

	/**
	 * Set the schema, and perform necessary calculations on it.
	 * NOTE: this should never be called if schemas are registered in some way with a backend.
	 *
	 * @method _setSchema
	 * @protected
	 * @param {Schema|Object} schema - A common-schema Schema object, or a plain object that
	 *   is transformed into a schema.
	 */
	_setSchema(schema) {
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
	 * @since v0.0.1
	 * @return {Schema}
	 */
	getSchema() {
		return this.schema;
	}

	/**
	 * Returns the keys for the documents based on which fields in the schema are marked
	 * with the `{ key: true }` flag.
	 *
	 * @method getKeys
	 * @since v0.0.1
	 * @return {String[]}
	 */
	getKeys() {
		return this._documentKeyFields;
	}

	/**
	 * Updates all documents matching a given query.
	 * This overrides the parent method so that it may benefit from #normalizeUpdate.
	 * See parent class, `Model`, for details.
	 *
	 * @method update
	 * @since v0.2.0
	 * @param {Object} query - The query to match documents
	 * @param {Object} update - The Mongo-style update expression used to update documents.
	 * @param {Object} [options={}]
	 * @return {Promise} - Resolves with the number of documents updated, or rejects with XError
	 */
	update(query, update, options = {}) {
		update = this.normalizeUpdate(update, options);
		return super.update(query, update, options);
	}

	/**
	 * Normalizes and validates the query that is passed in.
	 *
	 * @method normalizeQuery
	 * @since v0.0.1
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
	 * @since v0.0.1
	 * @param {Update|Object} update - The update expression
	 * @param {Object} [options] - Additional options to pass to the common-query normalizer
	 * @return {Update} - The update object after normalization
	 */
	normalizeUpdate(update, options = {}) {
		let normalizeOptions = objtools.merge(
			{},
			this.modelOptions || {},
			options,
			{ schema: this.schema }
		);
		if (_.isPlainObject(update)) {
			update = createUpdate(update, normalizeOptions);
		} else {
			update.normalize(normalizeOptions);
		}
		return update;
	}

	/**
	 * Normalizes and validates the aggregate spec passed in.
	 *
	 * @method normalizeAggregate
	 * @since v0.0.1
	 * @param {Aggregate|Object} aggregate - The aggregate spec
	 * @param {Object} [options] - Additional options to pass to the common-query normalizer
	 * @return {Aggregate} - The aggregate object after normalization
	 */
	normalizeAggregate(aggregate, options = {}) {
		let normalizeOptions = objtools.merge(
			{},
			this.modelOptions || {},
			options,
			{ schema: this.schema }
		);
		if (_.isPlainObject(aggregate)) {
			aggregate = createAggregate(aggregate, normalizeOptions);
		} else {
			aggregate.normalize(normalizeOptions);
		}
		return aggregate;
	}

}

module.exports = SchemaModel;
