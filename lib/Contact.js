var Promise = require('bluebird');

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
 * @return {Promise.<boolean>} Returns a promise which resolves `true` when the
 *                    contact is alive, and `false` if not.
 */
Contact.prototype.ping = function ping () {
  var me = this;
  return new Promise(function (resolve, reject) {
    resolve(me.node.onPing());
  });
};

/**
 * Find the closest k number of nodes in the network.
 * Recurses over the known nodes.
 * @param {Number[]} id         The id of a node
 * @return {Contact[]} The k contacts closest to the requested id
 *                     as found in the whole network. The returned contacts are
 *                     ordered by distance.
 */
// TODO: replace onFindContact with an async function (Promise)
Contact.prototype.findContact = function findContact (id) {
  // TODO: implement findContact
};

module.exports = Contact;
