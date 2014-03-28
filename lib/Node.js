var Promise = require('bluebird'),
    sha1 = require('sha1'),
    util = require('./util'),
    Id = require('./Id'),
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

  this.name = name;
  this.id   = new Id(sha1(name)); // SHA-1 hash of the name, as an array with 20 bytes

  this.buckets = [];    // k-buckets 0 <= i <= 160.
                        // Each k-bucket contains an array with up to k contacts,
                        // ordered from least-recently seen node to
                        // most-recently seen node.
  this.values = {};     // key value pairs
}

// TODO: when receiving a message from another node (onPing, onFindNode, ...), the k-bucket for the senders nodeID must be updated using onStoreNode

/**
 * Store or update the contact information of a node in the k-buckets of this
 * node.
 * @param {Contact} contact
 * @return {Promise.<>} Returns a promise which resolves then the node is
 *                      stored, or rejects when an error occurred.
 */
Node.prototype.onStoreNode = function onStoreNode (contact) {
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
          });
    }
  });
};

/**
 * Find the k number of nodes closest to given id.
 * The invoked node itself is excluded.
 * @param {Id | String | Number[]} id The id of a node
 * @return {Contact[]}                The k nodes closest to the requested id
 *                                    as known by this Node. The returned
 *                                    nodes are ordered by distance.
 */
Node.prototype.onFindNode = function onFindNode (id) {
  // convert the id to an Id if needed
  if (!(id instanceof Id)) id = new Id(id);

  // Find closest bucket
  var index = util.bucketIndex(this.id, id),
      bucket = this.buckets[index],
      contacts = [];

  if (bucket && bucket.length == K) {
    // take the k contacts from the closest bucket when this one is filled
    contacts = contacts.concat(bucket);
  }
  else {
    // take all known contacts
    for (var b = 0, bb = this.buckets.length; b < bb; b++) {
      bucket = this.buckets[b];
      if (bucket) contacts = contacts.concat(bucket);
    }
  }

  // sort the contacts by distance to given id
  util.sortByDistance(contacts, id);

  // limit the results to a maximum of k number of contacts
  if (contacts.length > K) {
    contacts = contacts.slice(0, K);
  }

  return contacts;
};

/**
 * Find the closest k number of nodes in the network closest to requested id.
 * Recurses over the known nodes.
 * Returned result can include the invoked node itself.
 * @param {Id | String | Number[]} id The id of a node
 * @return {Promise.<Contact[]>}      The k nodes closest to the requested id
 *                                    as found in the whole network. The
 *                                    returned nodes are ordered by distance.
 */Node.prototype.findNode = function findNode (id) {
  // convert the id to an Id if needed
  if (!(id instanceof Id)) id = new Id(id);

  var me = this;

  return new Promise(function (resolve, reject) {
    var contacts = [];    // all retrieved contacts
    var consulted = {};   // map with the contacts already consulted
    var inProgress = 0;   // number of lookups currently in progress

    /**
     * Recursive lookup of nodes:
     *  - lookup the first alpha number of closest known contacts,
     *  - retrieve the closest contacts they know,
     *  - merge retrieved contacts and order them by distance
     *  - repeat lookup until there are no unconsulted contacts left
     *    in the first alpha number of contacts
     */
    function lookup () {
      // see if the first alpha number of closest nodes contains unconsulted
      // nodes and if so, lookup these nodes
      contacts
          .slice(0, ALPHA)
          .filter(function (contact) {
            return (!(contact.id in consulted));
          })
          .forEach(function (contact) {
            // mark this contact as consulted
            consulted[contact.id] = contact;

            // request the closest contacts of this contact
            inProgress++;
            contact
                .findNode(id)
                .cancellable()
                .timeout(LOOKUP_TIMEOUT)
                .then(function (results) {
                  inProgress--;

                  // merge the newly retrieved contacts
                  contacts = contacts.concat(results);

                  // sort again by distance
                  util.sortByDistance(contacts, id);

                  // next lookup round
                  lookup();
                })
                .catch(function () {
                  inProgress--;

                  // remove this contact from the list. An other contact will
                  // then slide into the first alpha number of nodes, and will
                  // be looked up in the next round.
                  var index = contacts.indexOf(contact);
                  if (index != -1) contacts.splice(index, 1);

                  // next lookup round
                  lookup();
                });
          });

      // test whether there are no more lookups in progress and if so,
      // return the closest k nodes found
      if (!inProgress) resolve(contacts.slice(0, K));
    }

    // add this node itself to the list with contacts
    var contact = new Contact(me.id, me);
    contacts.push(contact);
    consulted[contact.id] = contact;

    // start the first lookup based on the locally known nodes
    contacts = contacts.concat(me.onFindNode(id));
    lookup();
  });
};

/**
 * Store a value on this node
 * @param {Id} key
 * @param {*} value
 */
Node.prototype.onStoreValue = function onStoreValue (key, value) {
  // TODO: also store a timestamp of the moment the value was originally published?
  // TODO: introduce a maximum number of value to be stored? (or a maximum size)
  this.values[key] = value;

  // TODO: the Node must republish the value every now and then (every 24 hours?)
  // TODO: the original publisher must republish the value every every 24 hours?
};

/**
 * Store a value on the k closest nodes
 * @param {Id} key
 * @param {*} value
 * @return {Promise.<Contact[]>}  Resolves with the list of nodes where the
 *                                value has been stored. Returned nodes
 *                                are sorted by distance to the key
 */
Node.prototype.storeValue = function storeValue (key, value) {
  // convert the key to an Id if needed
  if (!(key instanceof Id)) key = new Id(key);

  var me = this;

  return new Promise(function (resolve, reject) {
    me.findNode(key)
        .map(function (contact) {
          return new Promise(function (resolve, reject) {
            contact.storeValue(key, value)
                .then(function () {
                  resolve(contact);
                })
                .catch(function () {
                  resolve(null);
                });
          });
        })
        .filter(function (contact) {
          return (contact != null);
        })
        .then(function (contacts) {
          util.sortByDistance(contacts, key);
          resolve(contacts);
        });
  });
};

// TODO: implement deleteValue (or values disappear automatically when not republished in time)
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
  // TODO: implement leave
  this.buckets = [];
};

module.exports = Node;
