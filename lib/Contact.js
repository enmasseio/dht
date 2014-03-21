/**
 * A contact contains contact information of a Node
 * @param {Number[]} [id]
 * @param {Node} [node]
 * @constructor
 */
function Contact(id, node) {
  // TODO: in the future, don't store the node itself but it's ip address and port
  if (!(this instanceof Contact)) {
    throw new SyntaxError('Constructor must be called with the new operator');
  }

  this.id = id;
  this.node = node;
}

/**
 * Send a ping to the contact
 * @returns {boolean} Returns true when the contact is alive.
 */
Contact.prototype.ping = function ping () {
  // TODO: change ping to async
  return this.node.onPing();
};

module.exports = Contact;
