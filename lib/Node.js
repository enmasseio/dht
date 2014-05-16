var Promise = require('bluebird'),
    sha1 = require('sha1'),
    util = require('./util'),
    constants = require('./constants'),
    Id = require('./Id'),
    Host = require('./Host'),
    Contact = require('./Contact'),
    LocalHost = require('./LocalHost');

/**
 * A node for the distributed hash table
 * @constructor
 * @param {String} name       Node name
 * @param {String} [address]  IP-address for the host
 * @param {Number} [port]     UDP port for the host
 */
function Node (name, address, port) {
  var me = this;

  if (!(this instanceof Node)) {
    throw new SyntaxError('Constructor must be called with the new operator');
  }

  if (!name || typeof name !== 'string') {
    throw new TypeError('Parameter name must be a non-empty string');
  }

  // node name and id
  this.name = name;
  this.id   = new Id(sha1(name)); // SHA-1 hash of the name, as an array with 20 bytes

  // start a host
  if (address && port) {
    this.host = new Host(address, port);

    // attach RPC listeners
    this.host.on('PING', function (sender, method, params, callback) {
      var result = me.onPing();
      callback(null, result);
    });
    this.host.on('STORE', function (sender, method, params, callback) {
      me.onStoreValue(params.key, params.value);
      callback(null, null);
    });
    this.host.on('FIND_NODE', function (sender, method, params, callback) {
      var jsonContacts = me.onFindNode(params.id);
      callback(null, jsonContacts);
    });
    this.host.on('FIND_VALUE', function (sender, method, params, callback) {
      var result = me.onFindValue(params.key);
      callback(null, result);
    });
  }
  else {
    this.host = new LocalHost(this.id);
  }

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
 * @param {{id: string, address: string, port: number}} jsonContact
 * @return {Promise.<undefined, Error>} Returns a promise which resolves when
 *                                      the node is stored, or rejects when an
 *                                      error occurred.
 * @private
 */
Node.prototype.onStoreNode = function (jsonContact) {
  var me = this;
  var contact = new Contact(jsonContact);

  return new Promise(function (resolve, reject) {
    var i, ii, existingContact;

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
    else if (bucket.length < constants.K) {
      // bucket isn't yet full, add this new contact to the tail (most recent).
      bucket.push(contact);
      resolve();
    }
    else {
      // bucket is full. Check whether the least-seen contact is still alive
      // TODO: I'm afraid there will be a *lot* of ping requests. Limit the number of pings to this contact to once a minute?
      existingContact = bucket[0];
      me.sendPing(existingContact)
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
 * @return {Array.<{id: string, address: string, port: number}>}
 *                                    The k nodes closest to the requested id
 *                                    as known by this Node. The returned
 *                                    nodes are ordered by distance.
 * @private
 */
Node.prototype.onFindNode = function (id) {
  // convert the id to an Id if needed
  if (!(id instanceof Id)) id = new Id(id);

  // Find closest bucket
  var index = util.bucketIndex(this.id, id),
      bucket = this.buckets[index],
      contacts = [];

  if (bucket && bucket.length == constants.K) {
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
  if (contacts.length > constants.K) {
    contacts = contacts.slice(0, constants.K);
  }

  // return contacts as JSON objects
  return contacts.map(toJSON);
};

/**
 * Find the closest k number of nodes in the network closest to requested id.
 * Recurses over the known nodes.
 * Returned result can include the invoked node itself.
 * @param {Id | String | Number[]} id The id of a node
 * @return {Promise.<Array.<{id: string, address: string, port: number}>>}
 *                                    The k nodes closest to the requested id
 *                                    as found in the whole network. The
 *                                    returned nodes are ordered by distance.
 *                                    The promise is never rejected.
 */
Node.prototype.findNode = function (id) {
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
          .slice(0, constants.ALPHA)
          .filter(function (contact) {
            return (!(contact.id in consulted));
          })
          .forEach(function (contact) {
            // mark this contact as consulted
            consulted[contact.id] = contact;

            // request the closest contacts of this contact
            inProgress++;
            me.sendFindNode(contact, id)
                .cancellable()
                .timeout(constants.LOOKUP_TIMEOUT)
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

      // test whether there are no more lookups in progress and if not,
      // return the closest k nodes found
      if (!inProgress) {
        // return a maximum of K contacts, and return them as JSON
        resolve(contacts.slice(0, constants.K).map(toJSON));
      }
    }

    // add this node itself to the list with contacts
    var contact = new Contact({
      id: me.host.id,
      address: me.host.address,
      port: me.host.port
    });
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
 * @private
 */
Node.prototype.onStoreValue = function (key, value) {
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
 * @return {Promise.<Array.<{id: string, address: string, port: number}>>}
 *            Resolves with the list of nodes where the
 *            value has been stored. Returned nodes are sorted by distance to the key.
 *            The promise is never rejected.
 */
Node.prototype.storeValue = function (key, value) {
  // convert the key to an Id if needed
  if (!(key instanceof Id)) key = new Id(key);

  var me = this;

  return new Promise(function (resolve, reject) {
    me.findNode(key)
        .map(function (jsonContact) {
          return new Promise(function (resolve, reject) {
            me.sendStoreValue(jsonContact, key, value)
                .then(function () {
                  resolve(jsonContact);
                })
                .catch(function () {
                  resolve(null);
                });
          });
        })
        .filter(function (jsonContact) {
          return (jsonContact != null);
        })
        .then(function (jsonContacts) {
          var contacts = jsonContacts.map(toContact);
          util.sortByDistance(contacts, key);
          resolve(contacts.map(toJSON));
        });
  });
};

// TODO: implement deleteValue (or values disappear automatically when not republished in time)

/**
 * Find a value stored on this node.
 * @param {Id | String | Number[]} key
 * @returns {{value: * | null, nodes: Array.<{id: string, address: string, port: number}> | null}}
 *                Returns either:
 *                  (a) the value when found or
 *                  (b) the k nodes closest to the searched key
 * @private
 */
Node.prototype.onFindValue = function (key) {
  if (key in this.values) {
    // the node itself has the value, return it immediately
    return {
      value: this.values[key],
      nodes: null
    };
  }
  else {
    // return the k nodes closest to the key
    return {
      value: null,
      nodes: this.onFindNode(key)
    }
  }
};

/**
 * Find a value in the network by its key
 * @param {Id | String | Number[]} key
 * @returns {Promise.<*, Error>} Resolves the value or rejects with an error
 *                               when not found.
 */
Node.prototype.findValue = function (key) {
  // convert the key to an Id if needed
  if (!(key instanceof Id)) key = new Id(key);

  if (key in this.values) {
    // the node itself has the value, return it immediately
    var value = this.values[key];
    return new Promise(function (resolve, reject) {
      resolve(value);
    });
  }

  var me = this;

  // search the value in the network
  return new Promise(function (resolve, reject) {
    var contacts = [];    // all retrieved contacts
    var consulted = {};   // map with the contacts already consulted
    var promises = {};    // promises of lookups currently in progress
    var resolved = false;

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
          .slice(0, constants.ALPHA)
          .filter(function (contact) {
            return (!(contact.id in consulted));
          })
          .forEach(function (contact) {
            // mark this contact as consulted
            consulted[contact.id] = contact;

            // request the closest contacts of this contact
            promises[contact.id] = contact
                .findValue(key)
                .cancellable()
                .timeout(constants.LOOKUP_TIMEOUT)
                .then(function (result) {
                  // remove from the list of lookups in progress
                  delete promises[contact.id];

                  if (result.value) {
                    // hurray, the value is found!

                    // cancel all lookups in progress
                    for (var id in promises) {
                      if (promises.hasOwnProperty(id)) {
                        promises.cancel();
                      }
                    }
                    promises = {};

                    // TODO: store the value in the closest found node which did not return the value
                    // TODO: cached value must have an expiration time

                    // return the found value
                    resolve(result.value);
                    resolved = true;
                  }
                  else {
                    // merge the newly retrieved contacts
                    contacts = contacts.concat(result.nodes);

                    // sort again by distance
                    util.sortByDistance(contacts, key);

                    // next lookup round
                    lookup();
                  }
                })
                .catch(function () {
                  // remove from the list of lookups in progress
                  delete promises[contact.id];

                  // remove this contact from the list. An other contact will
                  // then slide into the first alpha number of nodes, and will
                  // be looked up in the next round.
                  var index = contacts.indexOf(contact);
                  if (index != -1) contacts.splice(index, 1);

                  // next lookup round
                  lookup();
                });
          });

      // test whether there are no more lookups in progress and if not,
      // reject the promise:
      if (Object.keys(promises).length == 0 && !resolved) {
        reject(new Error('Value not found (key ' + key + ')'));
      }
    }

    // start the first lookup based on the locally known nodes
    contacts = me.onFindNode(key).map(toContact);
    lookup();
  });
};

/**
 * Receive a ping and reply to it
 * @returns {boolean} Returns true when the node is alive.
 * @private
 */
Node.prototype.onPing = function () {
  return true;
};

/**
 * Send a message to a contact
 * @param {{id: string, address: string, port: number}} contact
 * @param {String} method
 * @param {Object} [params]
 * @return {Promise.<*, Error>} result
 * @private
 */
Node.prototype.send = function (contact, method, params) {
  var host = this.host;

  return new Promise(function (resolve, reject) {
    var rpc = {
      method: method,
      params: params || null
    };
    host.send(rpc, contact, function (error, result) {
      error ? reject(error) : resolve(result);
    })
  })
      .cancellable()
      .timeout(constants.SEND_TIMEOUT);
};

/**
 * Send a ping to a contact
 * @param {{id: string, address: string, port: number}} contact
 * @return {Promise.<boolean>}  Returns a promise which resolves `true` when the
 *                              node is alive, and `false` if not.
 *                              The promise is never rejected.
 * @private
 */
Node.prototype.sendPing = function (contact) {
  var me = this;
  return new Promise(function (resolve, reject) {
    me.send(contact, 'PING')
        .then(function (result) {
          resolve(result);
        })
        .catch(function (err) {
          resolve(false);
        });
  });
};

/**
 * Find the closest k number of nodes in the network closest to requested id.
 * The invoked node itself is not included in the results.
 * @param {{id: string, address: string, port: number}} contact
 * @param {Id} id                       The id of a node
 * @return {Promise.<Array.<{id: string, address: string, port: number}>, Error>}
 *                                      Contact information of the k nodes
 *                                      closest to the requested id known by the
 *                                      requested node. The returned contacts
 *                                      are ordered by distance.
 * @private
 */
Node.prototype.sendFindNode = function (contact, id) {
  return this.send(contact, 'FIND_NODE', {
    id: id.toString()
  });
};

/**
 * Send a value to a contact to be stored.
 * @param {{id: string, address: string, port: number}} contact
 * @param {Id} key                      The id of the value
 * @param {*} value                     The value itself, can be anything.
 * @return {Promise.<undefined, Error>} Resolves if successful, rejects on
 *                                      failure with an error message.
 * @private
 */
Node.prototype.sendStoreValue = function (contact, key, value) {
  return this.send(contact, 'STORE', {
    key: key.toString(),
    value: value
  });
};

/**
 * Find a value stored on a node.
 * @param {{id: string, address: string, port: number}} contact
 * @param {Id} key                       The id of a value
 * @return {Promise.<{value: * | null, nodes: Array.<{id: string, address: string, port: number}> | null}, Error>}
 *              Resolves with either:
 *                  (a) the value when found or
 *                  (b) the k nodes closest to the searched key
 *              or rejects with an error
 * @private
 */
Node.prototype.sendFindValue = function (contact, key) {
  return this.send(contact, 'FIND_VALUE', {
    key: key.toString()
  });
};

/**
 * Open configured UDP socket
 * @param {Function} [callback]    Callback executed once connection is opened.
 */
Node.prototype.open = function (callback) {
  if (!this.host) {
    throw new Error('No host configured');
  }

  this.host.open(callback);
};

/**
 * Close UDP socket
 */
Node.prototype.close = function () {
  if (!this.host) {
    throw new Error('No host configured');
  }

  this.host.close();
};

/**
 * Join a network via one of the networks nodes
 * @param {{id: string, address: string, port: number}} contact
 */
Node.prototype.join = function (contact) {
  // TODO: implement join (section 2.3, last paragraph)

  // store the contact in this nodes k-buckets

  // perform a node lookup for the nodes own ID
  // (this will result in the consulted nodes storing this node in their k-buckets)

  // refresh all k-buckets further away than its closest neighbor
};

/**
 * Convert an object to JSON by calling the toJSON function of the object.
 * Useful for example to convert an array to JSON with array.map(toJSON).
 * @param {Object} object
 * @return {JSON} json
 */
function toJSON (object) {
  return object.toJSON();
}

/**
 * Convert an object from JSON to a Contact by calling new Contact(json)
 * Useful for example to convert an array to JSON with array.map(toContact).
 * @param {{id: string, address: string, port: number}} jsonContact
 * @return {Contact} contact
 */
function toContact (jsonContact) {
  return new Contact(jsonContact);
}

module.exports = Node;
