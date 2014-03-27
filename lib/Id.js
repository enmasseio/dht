var sha1 = require('sha1');

/**
 * Id, holds an sha1 key
 * @param {String || Number[]} id     An id as hex string or byte array
 * @constructor
 */
function Id (id) {
  var isString = (typeof id === 'string');

  // TODO: only store the byte array?
  this.bytes = isString ? toBytes(id) : id;
}

/**
 * Create an Id from text. The sha1 key of the text is calculated and used as id.
 * The equivalent of this function is:
 *
 *     new Id(sha1(text));
 *
 * @param {String} text
 * @return {Id} The created id
 */
Id.create = function create (text) {
  var id = sha1(text, {
    asBytes: true
  });

  return new Id(id);
};

/**
 * Returns a string representation for the Id
 * @returns {String} A hex string
 */
Id.prototype.toString = function toString() {
  return toHex(this.bytes);
};

/**
 * Returns a JSON representation for the id
 * @returns {String} A hex string
 */
Id.prototype.toJSON = function toJSON() {
  return this.toString();
};

/**
 * Convert a hex string to a byte array
 * @param {String} string
 * @return {Number[]} Returns a byte array with numbers
 */
function toBytes (string) {
  var bytes = [];

  for (var i = 0, ii = string.length; i < ii; i += 2) {
    bytes.push(parseInt(string.charAt(i) + string.charAt(i + 1), 16));
  }

  return bytes;
}

/**
 * Convert a byte array to a string with hex values
 * @param {Number[]} bytes    A byte array with byte values
 * @return {String} Returns a hex string
 */
function toHex(bytes) {
  var string = '';

  for (var i = 0, ii = bytes.length; i < ii; i++) {
    var c = bytes[i].toString(16);
    string += (c.length == 1) ? '0' + c : c;
  }

  return string;
}

module.exports = Id;
