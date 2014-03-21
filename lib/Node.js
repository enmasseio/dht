var util = require('./util');

var K = 20;     // maximum number of nodes per k-bucket.
var ALPHA = 3;  // number of nodes to consult simultaneously during lookups

/**
 * A node for the distributed hash table
 * @constructor
 * @param {String} name
 */
function Node (name) {
  if (!(this instanceof Node)) {
    throw new SyntaxError('Constructor must be called with the new operator');
  }

  if (!name || typeof name !== 'string') {
    throw new TypeError('Parameter name must be a non-empty string');
  }

  this.name = name;
  this.id = util.key(name); // SHA-1 hash of the name, 160-bit key space

  this.buckets = [];    // k-buckets 0 <= i <= 160.
                        // Each k-bucket contains an array with up to k contacts,
                        // ordered from least-recently seen node to
                        // most-recently seen node.
}

/**
 * Store or update a contact in the k-buckets
 * @param {Contact} contact
 */
Node.prototype.storeContact = function storeContact(contact) {
  var i, ii, existingContact;

  // find the right bucket for this contact based on distance to our node
  var index = util.bucketIndex(this.id, contact.id);
  var bucket = this.buckets[index];
  if (!bucket) {
    bucket = [];
    this.buckets[index] = bucket;
  }

  // check if the contact is already listed in the bucket
  var b = null;
  for (i = 0, ii = bucket.length; i < ii; i++) {
    if (bucket[i].id == contact.id) {
      // yeah, found!
      b = i;
      break;
    }
  }

  if (b !== null) {
    // contact is already listed. Move it to the tail of the list (most recent).
    existingContact = bucket.splice(b, 1)[0];
    bucket.push(existingContact);
  }
  else {
    if (bucket.length < K) {
      // bucket isn't yet full, add this new contact to the tail (most recent).
      bucket.push(contact);
    }
    else {
      // bucket is full. Check whether the least-seen contact is still alive
      existingContact = bucket.shift();
      if (existingContact.ping()) { // TODO: ping method must become async
        // This contact is still alive. Move it to the buckets tail (it's
        // most-recent now), and ignore the new contact.
        bucket.push(existingContact);
      }
      else {
        // The existing contact is dead. Put the new contact back in the bucket
        // instead instead of the dead contact.
        bucket.push(contact);
      }
    }
  }
};

/**
 * Find a node in the network by its id
 * @param {Number[]} id         The id of a node
 * @return {Object[]} The k entries closest to the requested id.
 */
Node.prototype.findNode = function findNode (id) {
  // TODO: implement findNode
};

// TODO: implement storeValue
// TODO: implement findValue

/**
 * Receive a ping and reply to it
 * @returns {boolean} Returns true when the node is alive.
 */
// TODO: replace onPing with an async function (Promise based)
Node.prototype.onPing = function onPing () {
  return true;
};

/**
 * Join a network via one of the networks nodes
 * @param {Node} node
 */
Node.prototype.join = function join(node) {
  // TODO: implement join
};

/**
 * Leave the currently connected network. The node will empty its k-bucket and
 * returns false on a ping message.
 */
Node.prototype.leave = function leave () {
  // TODO: implement leave correctly once we have real remote nodes

  this.buckets = [];
  this.onPing = function noPing () {
    return false;
  };
};

module.exports = Node;
