const expect = require('chai').expect;
const _ = require('lodash');
const pasync = require('pasync');
const { createSchema } = require('zs-common-schema');
const { QueryValidationError } = require('zs-common-query');
const { SchemaModel, SchemaDocument } = require('../lib');

describe('SchemaModel', function() {
	class TestSchemaDocument extends SchemaDocument {
		save() {
			return this.normalize();
		}
	}

	class TestSchemaModel extends SchemaModel {
		create(data = {}) {
			return new TestSchemaDocument(this, data);
		}
	}

	const testSchemaData = {
		key1: { type: String, key: true },
		foo: {
			key2: { type: Date, key: true },
			bar: { type: String, required: true },
			baz: Number
		},
		biz: [ String ],
		buz: Boolean
	};

	it('should construct SchemaModel with a schema', function() {
		let testSchema = createSchema(testSchemaData);
		let testModel = new TestSchemaModel(testSchema);
		expect(testModel.getSchema().normalize).to.exist;
	});

	it('should implicitly construct a Schema given schema data', function() {
		let testModel = new TestSchemaModel(testSchemaData);
		expect(testModel.getSchema().normalize).to.exist;
	});

	it('should normalize queries', function() {
		let testModel = new TestSchemaModel(testSchemaData);
		let query = testModel.normalizeQuery({
			'foo.baz': '123',
			buz: 'true'
		});
		expect(query.getData()).to.deep.equal({
			'foo.baz': 123,
			buz: true
		});
	});

	it('should error when querying unschemad fields', function() {
		let testModel = new TestSchemaModel(testSchemaData);
		let query = {
			nonexist: 'foo'
		};
		expect(() => testModel.normalizeQuery(query)).to.throw(QueryValidationError);
	});

	it('unless the allowUnknownFields option is passed', function() {
		let testModel = new TestSchemaModel(testSchemaData, { allowUnknownFields: true });
		let query = {
			nonexist: 'foo'
		};
		testModel.normalizeQuery(query);
	});

	it('should normalize updates', function() {
		let testModel = new TestSchemaModel(testSchemaData);
		let update = testModel.normalizeUpdate({
			'foo.baz': '123',
			buz: 'true'
		});
		expect(update.getData()).to.deep.equal({
			$set: {
				'foo.baz': 123,
				buz: true
			}
		});
	});

	it('should normalize aggregates', function() {
		let testModel = new TestSchemaModel(testSchemaData);
		let aggregate = testModel.normalizeAggregate({
			stats: {
				'foo.key2': {
					count: true,
					min: true
				},
				buz: {
					min: true,
					max: true,
					avg: true
				}
			},
			total: true
		});
		expect(aggregate.getData()).to.deep.equal({
			stats: {
				'foo.key2': {
					count: true,
					min: true
				},
				buz: {
					min: true,
					max: true,
					avg: true
				}
			},
			total: true
		});
	});

	it('should return an ordered list of key fields with getKeys()', function() {
		let testModel = new TestSchemaModel(testSchemaData);
		expect(testModel.getKeys()).to.deep.equal([ 'key1', 'foo.key2' ]);
	});

	it('should normalize documents', function(done) {
		let testModel = new TestSchemaModel(testSchemaData);
		let testDocument = testModel.create({
			foo: {
				key2: '2015-01-01T00:00:00Z',
				bar: 1,
				baz: '1'
			},
			biz: [ true ],
			buz: 'false'
		});
		testDocument.normalize()
			.then((doc) => {
				expect(doc).to.equal(testDocument);
				expect(doc.getData()).to.deep.equal({
					foo: {
						key2: new Date('2015-01-01T00:00:00Z'),
						bar: '1',
						baz: 1
					},
					biz: [ 'true' ],
					buz: false
				});
				done();
			})
			.catch(done)
			.catch(pasync.abort);
	});

	it('should fail to normalize invalid documents', function(done) {
		let testModel = new TestSchemaModel(testSchemaData);
		let testDocument = testModel.create({ foo: {} });
		testDocument.normalize()
			.then(() => {
				done(new Error('Expected error'));
			})
			.catch((err) => {
				expect(err.message).to.match(/required/i);
				done();
			})
			.catch(done)
			.catch(pasync.abort);
	});

	it('should not fail to normalize if not requiring fields', function(done) {
		let testModel = new TestSchemaModel(testSchemaData);
		let testDocument = testModel.create({ foo: {} });
		testDocument.normalize({ allowMissingFields: true })
			.then(() => done())
			.catch(done)
			.catch(pasync.abort);
	});

	it('should fail if the object contains extra fields', function(done) {
		let testModel = new TestSchemaModel(testSchemaData);
		let testDocument = testModel.create({ foo: {
			bar: 'asdf',
			nonexist: 'foo'
		} });
		testDocument.normalize()
			.then(() => {
				done(new Error('Expected error'));
			})
			.catch((err) => {
				expect(err.message).to.match(/unknown/i);
				done();
			})
			.catch(done)
			.catch(pasync.abort);
	});

	it('should trigger hooks when normalizing documents', function(done) {
		let testModel = new TestSchemaModel(testSchemaData);
		let testDocument = testModel.create({ foo: { bar: 'asdf' } });
		let hooksCalled = [];
		let hooksExpected = [ 'pre-validate', 'post-validate', 'pre-normalize', 'post-normalize' ];
		_.forEach(hooksExpected, (hookName) => {
			testModel.hook(hookName, function(doc) {
				expect(doc).to.equal(testDocument);
				expect(this).to.equal(testModel);
				hooksCalled.push(hookName);
			});
		});
		testDocument.normalize()
			.then(() => {
				expect(hooksCalled).to.deep.equal(hooksExpected);
				done();
			})
			.catch(done)
			.catch(pasync.abort);
	});

	it('should be able to set a new schema', function() {
		let testModel = new TestSchemaModel({ foo: { type: Number, key: true } });
		expect(testModel.getKeys()).to.deep.equal([ 'foo' ]);
		testModel._setSchema({ bar: { type: Number, key: true } });
		expect(testModel.getKeys()).to.deep.equal([ 'bar' ]);
	});
});
