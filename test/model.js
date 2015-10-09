const { expect } = require('chai');
const _ = require('lodash');
const pasync = require('pasync');
const XError = require('xerror');
const zstreams = require('zstreams');
const { Model, Document } = require('../lib');

describe('Model', function() {
	it('::isModel', function() {
		let instance = new Model();

		expect(Model.isModel(instance)).to.be.true;
		expect(Model.isModel('foo')).to.be.false;
		expect(Model.isModel(true)).to.be.false;
		expect(Model.isModel(64)).to.be.false;
		expect(Model.isModel({ foo: 'bar' })).to.be.false;
		expect(Model.isModel([ 4, 16, 256 ])).to.be.false;
		expect(Model.isModel(/foo/)).to.be.false;
		expect(Model.isModel(new Date())).to.be.false;
	});

	it('should not infinitely recurse if neither find is implemented', function(done) {
		class TestModel extends Model { }
		const testModel = new TestModel();

		expect( () => {
			testModel.find({});
		} ).to.throw(XError);

		const blackholeStream = new zstreams.BlackholeStream();
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

	it('#update should have a working default implementation', function() {
		class TestDocument extends Document {
			save(props) {
				_.merge(this, props);
				return Promise.resolve(this);
			}
		}

		class TestModel extends Model {
			find() {
				return Promise.resolve([ new TestDocument({ foo: 'bar' }) ]);
			}
		}

		const testModel = new TestModel();
		return testModel.update({ foo: 'bar' }, { foo: 'baz' })
			.then((docs) => {
				expect(docs).to.have.length(1);
				expect(docs[0].foo).to.equal('baz');
			});
	});

	it('#remove should have a working default implementation', function() {
		let collection = new Set();

		class TestDocument extends Document {
			remove() {
				collection.delete(this);
				return Promise.resolve(this);
			}
		}

		class TestModel extends Model {
			insert() {
				let doc = new TestDocument({ foo: 'bar' });
				collection.add(doc);
				return Promise.resolve(doc);
			}
			find() {
				return Promise.resolve(Array.from(collection));
			}
		}

		const testModel = new TestModel();
		return testModel.insert({ foo: 'bar' })
			.then((doc) => {
				expect(doc).to.be.instanceof(TestDocument);
				expect(collection.size).to.equal(1);
				expect(collection.has(doc)).to.be.true;
			})
			.then(() => testModel.remove({ foo: 'bar' }))
			.then((doc) => {
				expect(collection.size).to.equal(0);
				expect(collection.has(doc)).to.be.false;
			});
	});

	it('#upsert should run #insert if no documents are found', function() {
		let hasRunInsert = false;
		let hasRunUpdate = false;

		class TestModel extends Model {
			count() { return Promise.resolve(0); }
			insert() { hasRunInsert = true; }
			update() { hasRunUpdate = true; }
		}

		const testModel = new TestModel();
		return testModel.upsert({ foo: 'bar' }, { foo: 'baz' })
			.then(() => {
				expect(hasRunInsert).to.be.true;
				expect(hasRunUpdate).to.be.false;
			});
	});

	it('#upsert should run #update if documents are found', function() {
		let hasRunInsert = false;
		let hasRunUpdate = false;

		class TestModel extends Model {
			count() { return Promise.resolve(1); }
			insert() { hasRunInsert = true; }
			update() { hasRunUpdate = true; }
		}

		const testModel = new TestModel();
		return testModel.upsert({ foo: 'bar' }, { foo: 'baz' })
			.then(() => {
				expect(hasRunInsert).to.be.false;
				expect(hasRunUpdate).to.be.true;
			});
	});

	it('#upsert should handle nested objects', function() {
		let hasRunInsert = false;
		let hasRunUpdate = false;

		class TestModel extends Model {
			count() { return Promise.resolve(0); }
			insert(doc) {
				hasRunInsert = true;
				return Promise.resolve(doc);
			}
			update() { hasRunUpdate = true; }
		}

		const testModel = new TestModel();
		return testModel.upsert({ 'foo.bar': 'baz' }, { 'foo.bar': 'qux' })
			.then((doc) => {
				expect(hasRunInsert).to.be.true;
				expect(hasRunUpdate).to.be.false;
				expect(doc.foo.bar).to.equal('qux');
			});
	});

	it('should delegate aggregateMulti() to aggregate()', function(done) {
		let i = 1;

		class TestModel extends Model {
			aggregate() {
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
