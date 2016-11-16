// Copyright 2016 Zipscene, LLC
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0

const Readable = require('zstreams').Readable;
const DocumentStream = require('./document-stream');
const inherits = require('inheritz');
const pasync = require('pasync');

class FakeDocumentStream extends Readable {

	constructor(model, query, findOptions) {
		super({ objectMode: true });
		this._fakeDocStream = {
			model, // The model referenced by this stream
			query, // Query to execute to get documents
			findOptions, // Options to supply to the query
			resultArray: null, // Once we get query results, the array of results
			resultPos: 0, // The position of the next result to return
			waitingForQuery: false // True while the query is running but results haven't returned
		};
	}

	_read() {
		if (this._fakeDocStream.resultArray) {
			while (this._fakeDocStream.resultPos < this._fakeDocStream.resultArray.length) {
				if (!this.push(this._fakeDocStream.resultArray[this._fakeDocStream.resultPos++])) {
					break;
				}
			}
			if (this._fakeDocStream.resultPos >= this._fakeDocStream.resultArray.length) {
				this.push(null);
			}
		} else if (!this._fakeDocStream.waitingForQuery) {
			this._fakeDocStream.waitingForQuery = true;
			try {
				this._fakeDocStream.model.find(this._fakeDocStream.query, this._fakeDocStream.findOptions)
					.then((results) => {
						this._fakeDocStream.resultArray = results;
						this._read();
					}, (err) => {
						this.emit('error', err);
					})
					.catch(pasync.abort);
			} catch (ex) {
				this.emit('error', ex);
			}
		}
	}

	getTotal() {
		if (this._fakeDocStream.resultArray && this._fakeDocStream.resultArray.total !== undefined) {
			return Promise.resolve(this._fakeDocStream.resultArray.total);
		} else {
			return this._fakeDocStream.model.count(this._fakeDocStream.query, this._fakeDocStream.findOptions);
		}
	}

}

inherits(FakeDocumentStream, DocumentStream);

module.exports = FakeDocumentStream;
