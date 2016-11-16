// Copyright 2016 Zipscene, LLC
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0

const expect = require('chai').expect;
const { createSchema } = require('common-schema');
const SchemaModel = require('../lib/schema-model/schema-model');
const SchemaDocument = require('../lib/schema-model/schema-document');

describe('SchemaDocument', function() {
	it('should normalize document data in constructor', function() {
		let model = new SchemaModel(createSchema({
			foo: Number,
			bar: Date
		}));
		let data = {
			foo: '12',
			bar: Date.now()
		};
		let document = new SchemaDocument(model, data);
		console.log(document.data);
		expect(document.data).to.have.property('foo', 12);
	});
});
