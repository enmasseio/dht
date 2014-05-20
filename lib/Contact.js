var Id = require('./Id');

/**
 * A contact contains contact information of a Node
 * @param {{id: string | Id, address: string, port: number}} properties
 * @constructor
 */
function Contact(properties) {
  if (!(this instanceof Contact)) {
    throw new SyntaxError('Constructor must be called with the new operator');
  }
  if (!('id' in properties)) {
    throw new SyntaxError('Required property "id" missing')
  }

  this.id = properties.id instanceof Id ? properties.id : new Id(properties.id);
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
