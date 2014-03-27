/**
 * Id
 * @param {String || Number[]} id An id as hex string or byte array
 * @constructor
 */
function Id (id) {
  var isString = (typeof id === 'string');

  // TODO: make hex and bytes readonly?
  this.hex   = isString ? id : toHex(id);
  this.bytes = isString ? toBytes(id) : id;
}

/**
 * Returns a string representation for the Id
 * @returns {String} A hex string
 */
Id.prototype.toString = function toString() {
  return this.hex;
};

/**
 * Returns a JSON representation for the id
 * @returns {String} A hex string
 */
Id.prototype.toJSON = function toJSON() {
  return this.hex;
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
 * @param {Number[]} bytes    A byte array with numbers
 * @return {String} Returns a hex string
 */
function toHex(bytes) {
  var string = '';

  for (var i = 0, ii = bytes.length; i < ii; i++) {
    string += bytes[i].toString(16);
  }

  return string;
}

module.exports = Id;
