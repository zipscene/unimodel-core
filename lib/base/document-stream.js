const XError = require('xerror');

/**
 * This mixin adds methods to make a readable object stream into a DocumentStream.  DocumentStreams
 * represent a stream of documents from a database.  The actual implementation of the document
 * stream is responsible for returning documents.
 *
 * The objects read from a DocumentStream should each be instances of Document .
 *
 * @class DocumentStream
 * @constructor
 */
class DocumentStreamMixin {

	/**
	 * Returns a promise that resolves with the total number of results.
	 *
	 * @method getTotal
	 * @return {Promise} - Resolves with a Number.  Rejects with an XError.
	 */
	getTotal() {
		throw new XError(XError.UNSUPPORTED_OPERATION, 'Getting the total is not supported on this model');
	}

}

module.exports = DocumentStreamMixin;
