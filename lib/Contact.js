var Promise = require('bluebird'),
    util = require('./util');

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
  this.idString = util.sha1ToString(id);
  this.node = node;
}

/**
 * Send a ping to the contact
 * @return {Promise.<boolean>} Returns a promise which resolves `true` when the
 *                    contact is alive, and `false` if not.
 */
Contact.prototype.ping = function ping () {
  var node = this.node;

  return new Promise(function (resolve, reject) {
    resolve(node ? node.onPing() : false);
    // TODO: add a timeout for a ping response as soon as this is an asynchronous RPC call
  });
};

/**
 * Find the closest k number of nodes in the network.
 * Find the k number of closest contacts from this Node.
 * @param {Number[]} id           The id of a node
 * @return {Promise.<Contact[]>}  The k contacts closest to the requested id
 *                                as known by this Node. The returned contacts
 *                                are ordered by distance.
 */
Contact.prototype.findContact = function findContact (id) {
  var me = this;

  return new Promise(function (resolve, reject) {
    if (me.node) {
      resolve(me.node.onFindContact(id));
    }
    else {
      reject(new Error('Connection error (node ' + me.id + ')'));
    }
  });
};

module.exports = Contact;
