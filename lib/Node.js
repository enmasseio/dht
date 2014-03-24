var Promise = require('bluebird'),
    util = require('./util'),
    Contact = require('./Contact');

// Constants
var K = 20;                 // maximum number of nodes per k-bucket.
var ALPHA = 3;              // number of nodes to consult simultaneously during node lookups
var LOOKUP_TIMEOUT = 10000; // milliseconds

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

  this.name   = name;
  this.id     = util.sha1(name, {asBytes: true });  // SHA-1 hash of the name, as an array with 20 bytes
  this.idText = util.sha1text(name);                // SHA-1 hash of the name, as a string with 40 hex characters

  this.buckets = [];    // k-buckets 0 <= i <= 160.
                        // Each k-bucket contains an array with up to k contacts,
                        // ordered from least-recently seen node to
                        // most-recently seen node.
}

/**
 * Store or update a contact in the k-buckets of this node
 * @param {Contact} contact
 * @return {Promise.<>} Returns a promise which resolves then the contact is
 *                      stored, or rejects when an error occurred.
 */
Node.prototype.onStoreContact = function onStoreContact (contact) {
  var me = this;
  return new Promise(function (resolve, reject) {
    var i, ii, existingContact;

    if (!(contact instanceof Contact)) {
      reject(new TypeError('Instance of contact expected as parameter contact'));
    }

    // find the right bucket for this contact based on distance to our node
    var index = util.bucketIndex(me.id, contact.id);
    var bucket = me.buckets[index];
    if (!bucket) {
      bucket = [];
      me.buckets[index] = bucket;
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
      resolve();
    }
    else if (bucket.length < K) {
      // bucket isn't yet full, add this new contact to the tail (most recent).
      bucket.push(contact);
      resolve();
    }
    else {
      // bucket is full. Check whether the least-seen contact is still alive
      existingContact = bucket[0];
      existingContact.ping()
          .then(function (alive) {
            // check if nothing changed during our ping
            if (bucket[0] === existingContact) {
              if (alive) {
                // This contact is still alive. Move it to the buckets tail (it's
                // most-recent now), and ignore the new contact.
                bucket.shift();
                bucket.push(existingContact);
              }
              else {
                // The existing contact is dead. Put the new contact back in the bucket
                // instead instead of the dead contact.
                bucket.shift();
                bucket.push(contact);
              }
            }
            resolve();
          })
          .catch(function (err) {
            reject(err);
          });
    }
  });
};

/**
 * Find the k number of closest contacts from this Node.
 * @param {Number[]} id   The id of a node
 * @return {Contact[]}    The k contacts closest to the requested id
 *                        as known by this Node. The returned contacts are
 *                        ordered by distance.
 */
Node.prototype.onFindContact = function onFindContact (id) {
  // Find closest bucket
  var index = util.bucketIndex(this.id, id),
      offset = 0,
      bucket,
      contacts = [];

  // get contacts from the closest bucket
  bucket = this.buckets[index];
  if (bucket) contacts = contacts.concat(bucket);

  // if the initial bucket is not filled, add contacts from surrounding buckets
  // until we have at least K buckets
  while ((contacts.length < K) &&
      (index - offset > 0) &&
      (index + offset < this.buckets.length)) {
    offset++;

    bucket = this.buckets[index - offset];
    if (bucket) contacts = contacts.concat(bucket);

    bucket = this.buckets[index + offset];
    if (bucket) contacts = contacts.concat(bucket);
  }

  // sort the contacts by distance
  // TODO: improve performance by caching the distances
  for (var n = 0; n < 1000; n++) {
    contacts.sort(function (a, b) {
      return util.compare(util.distance(id, a.id), util.distance(id, b.id));
    });
  }

  // limit the results to a maximum of k number of contacts
  if (contacts.length > K) {
    contacts = contacts.slice(0, K);
  }

  // TODO: should return a clone of the contacts
  return contacts;
};

/**
 * Find the closest k number of nodes in the network.
 * Recurses over the known nodes.
 * @param {Number[]} id           The id of a node
 * @return {Promise.<Contact[]>}  The k contacts closest to the requested id
 *                                as found in the whole network. The returned
 *                                contacts are ordered by distance.
 */
Node.prototype.findContact = function findContact (id) {
  var me = this;

  return new Promise(function (resolve, reject) {
    var contacts = me.onFindContact(id);

    var consulted = {}; // map with the contacts already consulted

    /* TODO: implement findContact
    // consult the first ALPHA nodes
    Promise
        .map(contacts.slice(0, ALPHA), function (contact) {
          consulted[contact.idText] = contact;
          return contact.findContact(id);
        })
        .then();
    */
  });
};

// TODO: implement storeValue
// TODO: implement findValue

/**
 * Receive a ping and reply to it
 * @returns {boolean} Returns true when the node is alive.
 */
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
  // TODO: implement leave correctly once we have real remote nodes (will become async?)

  this.buckets = [];
  this.onPing = function noPing () {
    return false;
  };
};

module.exports = Node;
