var Id = require('./Id');

/**
 * A contact contains contact information of a Node
 * @param {{id: string, address: string, port: number}} properties
 * @constructor
 */
function Contact(properties) {
  if (!(this instanceof Contact)) {
    throw new SyntaxError('Constructor must be called with the new operator');
  }

  this.id = new Id(properties.id);
  this.address = properties.address || null;
  this.port = properties.port || null;
}

/**
 * Convert a contact to json
 * @returns {{id: string, address: string, port: string}} contact
 */
Contact.prototype.toJSON = function () {
  return {
    id: this.id.toString(),
    address: this.address,
    port: this.port
  }
};

module.exports = Contact;
