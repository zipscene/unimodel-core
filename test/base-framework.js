const expect = require('chai').expect;
const XError = require('xerror');
const Model = require('../lib').Model;
const Document = require('../lib').Document;
const BlackholeStream = require('zstreams').BlackholeStream;
const pasync = require('pasync');
const zstreams = require('zstreams');
const _ = require('lodash');

describe('Base Framework', function() {

	describe('Model', function() {

		it('should not infinitely recurse if neither find is implemented', function(done) {

			class TestModel extends Model { }
			const testModel = new TestModel();

			expect( () => {
				testModel.find({});
			} ).to.throw(XError);

			const blackholeStream = new BlackholeStream();
			blackholeStream.intoPromise().then(() => {
				throw new Error('Expected error');
			}, (err) => {
				expect(err).to.be.an.instanceof(XError);
				done();
			}).catch(pasync.abort);

			try {
				testModel.findStream({}).pipe(blackholeStream);
			} catch (ex) {
				expect(ex).to.be.an.instanceof(XError);
				done();
			}

		});

		it('should delegate findStream() to find()', function(done) {

			class TestModel extends Model {
				find() {
					return Promise.resolve([ 1, 2, 3 ]);
				}
			}
			const testModel = new TestModel();
			testModel.findStream({}).intoArray().then((results) => {
				expect(results).to.deep.equal([ 1, 2, 3 ]);
				done();
			}).catch(done);
		});

		it('should delegate find() to findStream()', function(done) {

			class TestModel extends Model {
				findStream() {
					return zstreams.fromArray([ 1, 2, 3 ]);
				}
			}
			const testModel = new TestModel();
			testModel.find({}).then((results) => {
				expect(results).to.deep.equal([ 1, 2, 3 ]);
				done();
			}).catch(done);

		});

		it('should delegate findStream() getTotal() to find()', function(done) {

			class TestModel extends Model {
				find() {
					let ret = [ 1, 2, 3 ];
					ret.total = ret.length;
					return Promise.resolve(ret);
				}
			}
			const testModel = new TestModel();
			let stream = testModel.findStream({}, { total: true });
			stream.getTotal().then((total) => {
				expect(total).to.equal(3);
				done();
			}).catch(done);

		});

		it('should delegate count() to find()', function(done) {

			class TestModel extends Model {
				find() {
					let ret = [ 1, 2, 3 ];
					ret.total = ret.length;
					return Promise.resolve(ret);
				}
			}
			const testModel = new TestModel();
			testModel.count({}).then(function(total) {
				expect(total).to.equal(3);
				done();
			}).catch(done);

		});

		it('should delegate aggregateMulti() to aggregate()', function(done) {

			let i = 1;

			class TestModel extends Model {
				aggregate(query, aggregates) {
					return Promise.resolve([ i++ ]);
				}
			}
			const testModel = new TestModel();
			testModel.aggregateMulti({}, { foo: 0, bar: 0, baz: 0 }).then((results) => {
				expect(results).to.deep.equal({ foo: [ 1 ], bar: [ 2 ], baz: [ 3 ] });
				done();
			}).catch(done);

		});

	});

	describe('Document', function() {

		it('should trigger post-init hooks on init', function() {

			class TestDocument extends Document {
				constructor(model, data) { super(model, data); }
			}

			class TestModel extends Model {
				create(data) { return new TestDocument(this, data); }
			}

			const testModel = new TestModel();
			const docData = { foo: 'bar' };

			testModel.hook('post-init', function(doc) {
				expect(doc.getData()).to.deep.equal(docData);
				expect(this).to.equal(testModel);
				doc.getData().biz = 'baz';
			});

			const doc = testModel.create(docData);
			expect(doc.getData().biz).to.equal('baz');

		});

	});

});


