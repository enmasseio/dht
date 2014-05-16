var assert = require('assert'),
    freeport = require('freeport'),
    dgram = require('dgram'),
    sha1 = require('sha1'),
    Promise = require('bluebird'),
    constants = require('../lib/constants'),
    util = require('../lib/util'),
    Node = require('../lib/Node'),
    Contact = require('../lib/Contact'),
    Id = require('../lib/Id');

// Let's set timeouts very short for testing purposes...
constants.LOOKUP_TIMEOUT = 1000;
constants.SEND_TIMEOUT = 1000;

describe('Node', function() {

  it('should create a node', function () {
    var node = new Node('test');
    assert(node instanceof Node);
    assert(node.id instanceof Id);
  });

  it('should throw an error when creating a node without new keyword', function () {
    assert.throws(function () {Node()}, /Constructor must be called with the new operator/);
  });

  it('should throw an error when creating a node with wrong arguments', function () {
    assert.throws(function () {new Node('')}, /Parameter name must be a non-empty string/);
    assert.throws(function () {new Node()}, /Parameter name must be a non-empty string/);
    assert.throws(function () {new Node(1234)}, /Parameter name must be a non-empty string/);
  });

  describe('onStoreNode', function () {

    it('should store a node connection in the right bucket', function (done) {
      var node1 = new Node('node1');

      var id2 = Id.create('node2');
      var contact2 = {id: id2};
      var index2 = util.bucketIndex(node1.id, id2);
      assert.equal(index2, 159);

      var id3, contact3, index3;

      node1.onStoreNode(contact2)
          .then(function () {
            assert.deepEqual(node1.buckets[index2], [contact2].map(toContact));
          })
          .then(function () {
            id3 = new Id(sha1('node3'));
            contact3 = {id: id3};
            index3 = util.bucketIndex(node1.id, id3);
            assert.equal(index3, 158);

            return node1.onStoreNode(contact3);
          })
          .then(function () {
            assert.deepEqual(node1.buckets[index3], [contact3].map(toContact));
            done();
          });

    });

    it('should store an existing contact only once', function (done) {
      var node1 = new Node('node1');

      var id2 = new Id(sha1('node2'));
      var contact2 = {id: id2};
      var index2 = util.bucketIndex(node1.id, id2);
      assert.equal(index2, 159);

      node1.onStoreNode(contact2)
          .then(function () {
            assert.deepEqual(node1.buckets[index2], [contact2]);
          })

          .then(function() {
            // storing again should leave the bucket as it is
            return node1.onStoreNode(contact2);
          })
          .then(function () {
            assert.deepEqual(node1.buckets[index2], [contact2]);
            done();
          });
    });

    it('should move latest active contacts to the buckets tail', function (done) {
      var node1 = new Node('node1');

      // create two contacts with the same bucket index
      var id3 = new Id(sha1('node3'));
      var contact3 = {id: id3};
      var index3 = util.bucketIndex(node1.id, id3);
      assert.equal(index3, 158);

      var id4 = new Id(sha1('node4'));
      var contact4 = {id: id4};
      var index4 = util.bucketIndex(node1.id, id4);
      assert.equal(index4, 158);

      node1.onStoreNode(contact3)
          .then(function () { assert.deepEqual(node1.buckets[158], [contact3]); })

          .then(function () { return node1.onStoreNode(contact4); })
          .then(function () {assert.deepEqual(node1.buckets[158], [contact3, contact4]); })

          .then(function () { return node1.onStoreNode(contact3); })
          .then(function () {assert.deepEqual(node1.buckets[158], [contact4, contact3]); })

          .then(function () { return node1.onStoreNode(contact3); })
          .then(function () {assert.deepEqual(node1.buckets[158], [contact4, contact3]); })

          .then(function () { return node1.onStoreNode(contact4); })
          .then(function () {assert.deepEqual(node1.buckets[158], [contact3, contact4]); })

          .then(function () {
            done();
          })
    });

    it.skip('should not replace existing, alive contact for new contact when the bucket is full', function (done) {
      var node1 = new Node('node1');

      var node2 = new Node('node2');
      var contact2 = {id: node2.id};
      var index2 = util.bucketIndex(node1.id, node2.id);
      assert.equal(index2, 159);

      // create a lot of contacts
      var contacts = [];
      for (var i = 0; i < 50; i++) {
        var node = new Node('node' + (i + 3));
        var contact = {id: node.id};
        contacts.push(contact);
      }

      var bucket, leastSeen;
      Promise
          .map(contacts, function (contact) {
            return node1.onStoreNode(contact);
          })
          .then(function () {
            bucket = node1.buckets[index2];
            assert.equal(bucket && bucket.length, 20, 'Bucket ' + index2 + ' of node2 should be filled for this test');

            leastSeen = bucket[0];

            return node1.onStoreNode(contact2);
          })
          .then(function () {
            // node2 should not be added, leastSeen should be moved to tail
            assert.deepEqual(bucket[bucket.length - 1], leastSeen);

            done();
          });
    });

    it('should replace existing, dead contact for a new contact when the bucket is full', function (done) {
      var node1 = new Node('node1');

      var node2 = new Node('node2');
      var contact2 = {id: node2.id};
      var index2 = util.bucketIndex(node1.id, node2.id);
      assert.equal(index2, 159);

      // create a lot of contacts
      var contacts = [];
      for (var i = 0; i < 50; i++) {
        var node = new Node('node' + (i + 3));
        var contact = {id: node.id};
        contacts.push(contact);
      }

      var bucket;
      Promise
          .map(contacts, function (contact) {
            return node1.onStoreNode(contact);
          })
          .then(function () {
            bucket = node1.buckets[index2];
            assert.equal(bucket && bucket.length, 20, 'Bucket ' + index2 + ' of node2 should be filled for this test');

            // change the leastSeen to dead
            var leastSeen = bucket[0];
            delete leastSeen.node;

            return node1.onStoreNode(contact2);
          })
          .then(function () {
            // node2 should be added, leastSeen should be removed
            assert.deepEqual(bucket[bucket.length - 1], contact2);
            done();
          });
    });

  });
  
  describe('onFindNode', function () {
    var node1;

    before(function (done) {
      node1 = new Node('node1');

      // create two contacts with the same bucket index
      var contacts = [];
      for (var i = 0; i < 1000; i++) {
        var node = new Node('node' + (i + 3));
        var contact = {id: node.id};
        contacts.push(contact);
      }

      Promise
          .map(contacts, function (contact) {
            return node1.onStoreNode(contact);
          })
          .then(function () {
            done();
          });
    });

    it.skip('should find the closest k contacts from a node having less than k contacts', function (done) {
      var node = new Node('node1');

      // node has no contacts
      var someId = new Id(sha1('someId'));
      assert.equal(node.onFindNode(someId).length, 0);

      // node with one contact
      var contact = {id: sha1('node2')};
      node.onStoreNode(contact).then(function () {
        assert.equal(node.onFindNode(someId).length, 1);
        done();
      });
    });

    it.skip('should find the closest k contacts from a node from a filled bucket', function () {
      // pick one node from one of the buckets of node1 to search
      var theLuckyBucket = 158; // bucket 158 contains 20 contacts
      var searchedNode = node1.buckets[theLuckyBucket][10].node;

      var id = searchedNode.id;
      var index = util.bucketIndex(node1.id, id);
      assert.equal(index, theLuckyBucket);
      assert.equal(node1.buckets[index].length, 20,
          'Bucket with ' + theLuckyBucket + ' must be filled for this test');

      var contacts = node1.onFindNode(id);
      assert.equal(contacts.length, 20);
      assert.deepEqual(contacts[0].node, searchedNode);
    });

    it.skip('should find the closest k contacts from a node, from a non-filled bucket', function () {
      // pick one node from one of the buckets of node1 to search
      var theLuckyBucket = 152; // bucket 152 contains 2 contacts
      var searchedNode = node1.buckets[theLuckyBucket][1].node;

      var id = searchedNode.id;
      var index = util.bucketIndex(node1.id, id);
      assert.equal(index, theLuckyBucket);
      assert.equal(node1.buckets[index].length, 2, 'huh? I thought bucket ' + theLuckyBucket + ' contained 2 nodes?');

      var contacts = node1.onFindNode(id);
      assert.equal(contacts.length, 20);
      assert.deepEqual(contacts[0].node, searchedNode);
    });

    it.skip('should find the closest k contacts from a node which is not listed itself', function () {
      // node 100 is not listed in the contacts of node1
      var searchedNode = new Node('foo');
      var id = searchedNode.id;
      var contacts = node1.onFindNode(id);

      // do the search ourselves, see if it matches the returned results
      var allContacts = node1.buckets
          .reduce(function (prev, cur) {
            return prev.concat(cur);
          })
          .sort(function (a, b) {
            return util.compare(util.distance(id, a.id), util.distance(id, b.id));
          })
          .splice(0, 20);

      // see if we end up with the same results (but from a raw search
      assert.deepEqual(contacts, allContacts);
    });

    it.skip('should find the closest k contacts to the nodes id itself', function () {
      // node 100 is not listed in the contacts of node1
      var id = node1.id;
      var contacts = node1.onFindNode(id);

      // do the search ourselves, see if it matches the returned results
      var allContacts = node1.buckets
          .reduce(function (prev, cur) {
            return prev.concat(cur);
          })
          .sort(function (a, b) {
            return util.compare(util.distance(id, a.id), util.distance(id, b.id));
          })
          .splice(0, 20);

      // see if we end up with the same results (but from a raw search
      assert.deepEqual(contacts, allContacts);
    });

  });

  describe('findNode', function () {

    it.skip('should find the closest k contacts in a network one level deep', function (done) {
      var node1 = new Node('node1');
      var node2 = new Node('node2');
      var node3 = new Node('node4');
      var contact1 = {id: node1.id};
      var contact2 = {id: node2.id};
      var contact3 = {id: node3.id};

      Promise
          .all([
              node1.onStoreNode(contact2),
              node1.onStoreNode(contact3)
          ])

          // find node2
          .then(function () {
            return node1.findNode(sha1('node2'));
          })
          .then(function (contacts) {
            assert.deepEqual(contacts, [contact2, contact3, contact1]);
          })

          // find node4
          .then(function () {
            return node1.findNode(sha1('node4'));
          })
          .then(function (contacts) {
            assert.deepEqual(contacts, [contact3, contact1, contact2]);
          })

          .then(function () {
            done();
          });
    });

    it.skip('should find the closest k contacts in a network with one level deep and special outlier bucket', function (done) {
      var node0 = new Node('node0');

      var nodes = [];
      for (var i = 1; i < 22; i++) {
        var nodeI = new Node('node' + i);
        nodes.push(nodeI);
      }
      // there is an outlier, node10, in its own bucket

      var k = 20;
      var allContacts;

      Promise
          .map(nodes, function (node) {
            var contact = {id: node.id};
            return node0.onStoreNode(contact);
          })

          .then(function () {
            // node0 has not stored all contacts (only k per bucket)
            allContacts = node0.buckets
                .filter(function (bucket) {
                  return bucket;
                })
                .reduce(function (prev, cur) {
                  return prev.concat(cur);
                });

            allContacts.push({id: node0.id});

            util.sortByDistance(allContacts, Id.create('foo'));
          })

          .then(function () {
            return node0.findNode(sha1('foo'));
          })
          .then(function (contacts) {
            assert.deepEqual(contacts, allContacts.slice(0, k));
          })

          .then(function () {
            done();
          });
    });

    it.skip('should find the closest k contacts in a network two levels deep', function (done) {
      var node1 = new Node('node1');
      var node2 = new Node('node2');
      var node3 = new Node('node3');
      var contact1 = {id: node1.id};
      var contact2 = {id: node2.id};
      var contact3 = {id: node3.id};

      Promise
          .all([
            node1.onStoreNode(contact2),
            node2.onStoreNode(contact3)
          ])

          // find node3 from node2
          .then(function () {
            return node2.findNode(sha1('node3'));
          })
          .then(function (contacts) {
            assert.deepEqual(contacts, [contact3, contact2]);
          })

          // find node2 from node1
          .then(function () {
            return node1.findNode(sha1('node2'));
          })
          .then(function (contacts) {
            assert.deepEqual(contacts, [contact2, contact3, contact1]);
          })

          // find node3 from node1
          .then(function () {
            return node1.findNode(sha1('node3'));
          })
          .then(function (contacts) {
            assert.deepEqual(contacts, [contact3, contact1, contact2]);
          })

          .then(function () {
            done();
          });
    });

    // TODO: should find the closest k contacts in a network n levels deep
    it.skip('should find the closest k contacts in a network n levels deep', function () {

    });

    it.skip('should find the closest k contacts in a network with a dead node', function (done) {
      var node1 = new Node('node1');

      var contact1 = {id: node1.id};
      var contact2 = {id: node2.id}; // Note: node2 does not exist

      Promise
          .all([
            node1.onStoreNode(contact2)
          ])

          // find node2 from node1
          .then(function () {
            return node1.findNode(sha1('node2'));
          })
          .then(function (contacts) {
            assert.deepEqual(contacts, [contact1]); // must return only node1 as node2 is dead
          })

          .then(function () {
            done();
          });
    });

    it.skip('should find the closest k contacts in a network with some dead nodes', function (done) {
      var node1 = new Node('node1');
      var node3 = new Node('node3');
      var contact1 = {id: node1.id};
      var contact2 = {id: sha1('node2')}; // dead contact
      var contact3 = {id: node3.id};
      var contact4 = {id: sha1('node4')}; // dead contact

      Promise
          .all([
            node1.onStoreNode(contact2),
            node1.onStoreNode(contact3),
            node3.onStoreNode(contact4)
          ])

          // find node4 from node1
          .then(function () {
            return node1.findNode(sha1('node4'));
          })
          .then(function (contacts) {
            // should return the only alive contacts: node3 and node1
            assert.deepEqual(contacts, [contact3, contact1]);
          })

          .then(function () {
            done();
          });
    });

  });

  describe('onStoreValue', function () {

    it('should store a value', function () {
      var node1 = new Node('node1');
      var id = Id.create('foo');
      node1.onStoreValue(id, 'bar');

      assert.deepEqual(Object.keys(node1.values), [sha1('foo')]);
      assert.deepEqual(node1.values[sha1('foo')], 'bar');
    });

    it('should store multiple values', function () {
      var node1 = new Node('node1');
      node1.onStoreValue(Id.create('foo'), 'bar');
      node1.onStoreValue(Id.create('ooz'), 'baz');

      assert.deepEqual(Object.keys(node1.values).sort(), [sha1('foo'), sha1('ooz')]);
      assert.deepEqual(node1.values[sha1('foo')], 'bar');
      assert.deepEqual(node1.values[sha1('ooz')], 'baz');
    });

    it('should replace a stored a value', function () {
      var node1 = new Node('node1');
      node1.onStoreValue(Id.create('foo'), 'bar');

      assert.deepEqual(Object.keys(node1.values), [sha1('foo')]);
      assert.deepEqual(node1.values[sha1('foo')], 'bar');

      node1.onStoreValue(Id.create('foo'), 'baz');

      assert.deepEqual(Object.keys(node1.values), [sha1('foo')]);
      assert.deepEqual(node1.values[sha1('foo')], 'baz');
    });

  });

  describe('storeValue', function () {

    it.skip('should store a value on nodes in the network', function (done) {
      var node1 = new Node('node1');
      var node2 = new Node('node2');
      var node3 = new Node('node3');
      var contact1 = {id: node1.id};
      var contact2 = {id: node2.id};
      var contact3 = {id: node3.id};

      Promise
          .all([
            node1.onStoreNode(contact2),
            node2.onStoreNode(contact3)
          ])

          .then(function () {
            return node1.storeValue(sha1('foo'), 'bar');
          })

          .then(function (contacts) {
            console.log('ACTUAL', contacts)
            console.log('EXPECTED', [contact2, contact3, contact1])
            assert.deepEqual(contacts, [contact2, contact3, contact1]);

            assert.equal(Object.keys(node1.values).length, 1);
            assert.deepEqual(node1.values[sha1('foo')], 'bar');

            assert.equal(Object.keys(node2.values).length, 1);
            assert.deepEqual(node2.values[sha1('foo')], 'bar');

            assert.equal(Object.keys(node3.values).length, 1);
            assert.deepEqual(node3.values[sha1('foo')], 'bar');
          })

          .then(function () {
            done();
          });
    });

    it.skip ('should store a value in a network containing dead nodes', function (done) {
      var node1 = new Node('node1');
      var node2 = new Node('node2');
      var node4 = new Node('node4');
      var contact1 = {id: node1.id};
      var contact2 = {id: node2.id};
      var contact3 = {id: Id.create('node3')}; // dead contact
      var contact4 = {id: node4.id};
      var contact5 = {id: Id.create('node5')}; // dead contact

      Promise
          .all([
            node1.onStoreNode(contact2),
            node1.onStoreNode(contact3),
            node2.onStoreNode(contact4),
            node2.onStoreNode(contact5)
          ])

          .then(function () {
            return node1.storeValue(sha1('foo'), 'bar');
          })

          .then(function (contacts) {
            assert.deepEqual(contacts, [contact2, contact4, contact1]);

            assert.equal(Object.keys(node1.values).length, 1);
            assert.deepEqual(node1.values[sha1('foo')], 'bar');

            assert.equal(Object.keys(node2.values).length, 1);
            assert.deepEqual(node2.values[sha1('foo')], 'bar');

            assert.equal(Object.keys(node4.values).length, 1);
            assert.deepEqual(node4.values[sha1('foo')], 'bar');
          })

          .then(function () {
            done();
          });
    });

    it.skip ('should store a value on the k closest nodes of the network', function (done) {
      var node0 = new Node('node0');

      var nodes = [];
      for (var i = 1; i < 50; i++) {
        var nodeI = new Node('node' + i);
        nodes.push(nodeI);
      }

      var k = 20;
      var allContacts;

      Promise
          .map(nodes, function (node) {
            var contact = {id: node.id};
            return node0.onStoreNode(contact);
          })

          .then(function () {
            // node0 has not stored all contacts (only k per bucket)
            allContacts = node0.buckets
                .filter(function (bucket) {
                  return bucket;
                })
                .reduce(function (prev, cur) {
                  return prev.concat(cur);
                }, [{id: node0.id}]);

            util.sortByDistance(allContacts, Id.create('foo'));
          })

          .then(function () {
            return node0.storeValue(sha1('foo'), 'bar');
          })
          .then(function (contacts) {
            assert.deepEqual(contacts, allContacts.slice(0, k));

            var withValue = allContacts.slice(0, k);
            var withoutValue = allContacts.slice(k);
            assert.equal(withValue.length, k);

            withValue.forEach(function (contact, index) {
              assert.equal(Object.keys(contact.node.values).length, 1);
              assert.deepEqual(contact.node.values[sha1('foo')], 'bar');
            });

            withoutValue.forEach(function (contact) {
              assert.equal(Object.keys(contact.node.values).length, 0);
            })
          })

          .then(function () {
            done();
          });
    });
  });

  describe('onFindValue', function () {

    it('should return a value from a node when available', function (done) {
      var node1 = new Node('node1');
      var node2 = new Node('node2');
      var node3 = new Node('node3');
      var contact2 = {id: node2.id};
      var contact3 = {id: node3.id};
      var key = Id.create('foo');

      Promise
          .all([
              node1.onStoreNode(contact2),
              node1.onStoreNode(contact3)
          ])

          .then(function () {
            return node1.onStoreValue(key, 'bar');
          })

          .then(function () {
            assert.deepEqual(node1.onFindValue(key), {
              value: 'bar',
              nodes: null
            });
          })

          .then(function () {
            done()
          });
    });

    it('should return the closest contacts from a node a value is not found', function (done) {
      var node1 = new Node('node1');
      var node2 = new Node('node2');
      var node3 = new Node('node3');
      var contact2 = {id: node2.id};
      var contact3 = {id: node3.id};
      var key = Id.create('foo');

      Promise
          .all([
            node1.onStoreNode(contact2),
            node1.onStoreNode(contact3)
          ])

          .then(function () {
            assert.deepEqual(node1.onFindValue(key), {
              value: null,
              nodes: [contact2, contact3]
            });
          })

          .then(function () {
            done()
          });
    });

  });

  describe('findValue', function () {

    it.skip('should find a value stored on the requested node', function (done) {
      var node1 = new Node('node1');
      var key = Id.create('foo');
      var value = 'bar';

      node1
          .storeValue(key, value)
          .then(function () {
            return node1.findValue(key);
          })
          .then(function (value) {
            assert.equal(value, 'bar');

            done();
          });
    });

    it.skip('should find a value not stored on the requested node', function (done) {
      var node1 = new Node('node1');
      var node2 = new Node('node2');
      var contact2 = {id: node2.id};
      var key = Id.create('foo');
      var value = 'bar';

      Promise
          .all([
            node1.onStoreNode(contact2),
            node2.storeValue(key, value)
          ])
          .then(function () {
            return node1.findValue(key);
          })
          .then(function (value) {
            assert.equal(value, 'bar');

            done();
          });
    });

    it.skip('should throw an error when a value is not found', function (done) {
      var node1 = new Node('node1');
      var node2 = new Node('node2');
      var contact2 = {id: node2.id};
      var key = Id.create('foo');

      node1
          .onStoreNode(contact2)
          .then(function () {
            return node1.findValue(key);
          })
          .catch(function (err) {
            assert(/Value not found/.test(err));
            done();
          });
    });

  });

  describe('onPing', function () {

    it('should reply to a ping', function () {
      var node1 = new Node('node1');
      assert.strictEqual(node1.onPing(), true);
    });

  });

  describe('UDP', function () {

    it('should open a UDP socket', function (done) {
      function test (port) {
        var address = '127.0.0.1';
        var node1 = new Node('node1', address, port);

        node1.open(function () {
          node1.close();
          done();
        });
      }

      freeport(function (err, port) {
        test(port);
      })
    });

    it('should send a PING request', function (done) {
      function test (port) {
        var address = '127.0.0.1';
        var node1 = new Node('node1', address, port);

        node1.open(function () {
          var request = {
            id: 123,
            method: 'PING'
          };
          var message = new Buffer(JSON.stringify(request));
          var client = dgram.createSocket('udp4');
          client.on('message', function (message, remote) {
            var response = JSON.parse(message);

            assert.deepEqual(response, {id: 123, error: null, result: true});

            node1.close();
            client.close();

            done()
          });

          client.send(message, 0, message.length, port, address, function(err, bytes) {
            if (err) throw err;
          });
        });
      }

      freeport(function (err, port) {
        test(port);
      })
    });

    it('should send a STORE request', function (done) {
      function test (port) {
        var address = '127.0.0.1';
        var node1 = new Node('node1', address, port);

        node1.open(function () {
          var name = 'myvalue';
          var key = Id.create(name);
          var value = 'Hello world!';

          var request = {
            id: 123,
            method: 'STORE',
            params: {
              key: key,
              value: value
            }
          };

          var message = new Buffer(JSON.stringify(request));
          var client = dgram.createSocket('udp4');
          client.on('message', function (message, remote) {
            var response = JSON.parse(message);

            assert.deepEqual(response, {id: 123, error: null, result: null});
            assert.equal(node1.values[key], value);

            node1.close();
            client.close();

            done()
          });

          client.send(message, 0, message.length, port, address);
        });
      }

      freeport(function (err, port) {
        test(port);
      })
    });

    it('should send a FIND_NODE request', function (done) {
      function test (port1, port2) {
        var address = '127.0.0.1';
        var node1 = new Node('node1', address, port1);

        var name = 'node2';
        var id = Id.create(name);
        var contact = {
          id: id,
          address: address,
          port: port2
        };
        node1.onStoreNode(contact);

        node1.open(function () {
          var request = {
            id: 123,
            method: 'FIND_NODE',
            params: {
              id: id
            }
          };

          var message = new Buffer(JSON.stringify(request));
          var client = dgram.createSocket('udp4');
          client.on('message', function (message, remote) {
            var response = JSON.parse(message);

            assert.deepEqual(response, {
              id: 123,
              error: null,
              result: [{
                id: id.toString(),
                address: address,
                port: port2
              }]
            });

            node1.close();
            client.close();

            done()
          });

          client.send(message, 0, message.length, port1, address);
        });
      }

      freeport(function (err, port1) {
        freeport(function (err, port2) {
          test(port1, port2);
        })
      })
    });

    it('should send a FIND_VALUE request', function (done) {
      function test (port1, port2) {
        var address = '127.0.0.1';
        var node1 = new Node('node1', address, port1);

        var name = 'myvalue';
        var key = Id.create(name);
        var value = 'Hello world!';

        node1.onStoreValue(key, value);

        node1.open(function () {
          var request = {
            id: 123,
            method: 'FIND_VALUE',
            params: {
              key: key
            }
          };

          var message = new Buffer(JSON.stringify(request));
          var client = dgram.createSocket('udp4');
          client.on('message', function (message, remote) {
            var response = JSON.parse(message);

            assert.deepEqual(response, {
              id: 123,
              error: null,
              result: {
                value: value,
                nodes: null
              }
            });

            node1.close();
            client.close();

            done()
          });

          client.send(message, 0, message.length, port1, address);
        });
      }

      freeport(function (err, port1) {
        freeport(function (err, port2) {
          test(port1, port2);
        })
      })
    });

  });

  describe('send', function () {
    var node1 = null;
    var node2 = null;
    var contact1 = null;
    var contact2 = null;
    var contact3 = null; // a dead contact!

    beforeEach(function (done) {
      freeport(function (err, port1) {
        freeport(function (err, port2) {
          freeport(function (err, port3) {
            var address = '127.0.0.1';

            node1 = new Node('node1', address, port1);
            node2 = new Node('node2', address, port2);
            // we don't create a node3, node3 will serve as a dead contact

            contact1 = {id: Id.create('node1').toString(), address: address, port: port1};
            contact2 = {id: Id.create('node2').toString(), address: address, port: port2};
            contact3 = {id: Id.create('node3').toString(), address: address, port: port3};

            node1.open(function () {
              node2.open(function () {
                done();
              });
            });
          })
        })
      })
    });

    afterEach(function () {
      node1.close();
      node2.close();

      node1 = null;
      node2 = null;
      contact1 = null;
      contact2 = null;
      contact3 = null;
    });

    it('should ping a live contact', function (done) {
      node1.sendPing(contact2).then(function (alive) {
        assert.strictEqual(alive, true);
        done();
      });
    });

    it('should ping a dead contact', function (done) {
      node1.sendPing(contact3).then(function (alive) {
        assert.strictEqual(alive, false);
        done();
      });
    });

    it.skip('should find a contact', function (done) {
      node2.onStoreNode(contact3);
      node1.sendFindNode(contact2, contact3.id).then(function (results) {
        assert.deepEqual(results, [contact3]);
        done();
      });
    });

    it('should throw an error when finding a value failed', function (done) {
      node1.sendFindNode(contact3, Id.create('node2'))
          .catch(function (err) {
            assert(/Timeout/.test(err));
            done();
          });
    });

    it('should store a value', function (done) {
      var key = Id.create('foo');
      var value = 'bar';

      node1.sendStoreValue(contact2, key, value)
          .then(function () {
            assert.equal(Object.keys(node2.values).length, 1);
            assert.equal(node2.values[key], 'bar');

            done();
          });
    });

    it('should throw an error when storing a value failed', function (done) {
      var key = Id.create('foo');
      var value = 'bar';

      node1.sendStoreValue(contact3, key, value)
          .then(function () {
            assert.ok(false);
          })
          .catch(function (err) {
            assert(/Timeout/.test(err));
            done();
          });
    });

    it.skip('should find a value', function (done) {
      var key = Id.create('foo');
      var value = 'bar';

      node2.onStoreValue(key, value);

      node1
          .onStoreNode(contact2)

          .then(function () {
            return node1.sendFindValue(contact2, key)
          })

          .then(function (response) {
            assert.deepEqual(response, {
              value: 'bar',
              nodes: null
            });

            done();
          });
    });

    it.skip('should receive closest nodes when value is not found', function (done) {
      var key = Id.create('foo');

      node1
          .onStoreNode(contact2)

          .then(function () {
            return node1.sendFindValue(contact1, key);
          })

          .then(function (response) {
            assert.deepEqual(response, {
              value: null,
              nodes: [contact2]
            });

            done();
          });
    });

    it('should throw an error when searching a value failed', function (done) {
      var key = Id.create('foo');

      node1.sendFindValue(contact3, key)
          .then(function () {
            assert.ok(false);
          })
          .catch(function (err) {
            assert(/Timeout/.test(err));
            done();
          });
    });

  });

  // TODO: should join a network
  it.skip('should join a network', function () {

  });

  // TODO: should leave a network
  it.skip('should leave a network', function () {

  });

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

  function bucketsToJSON(buckets) {
    return buckets
        .map(function (bucket, index) {
          return {
            index: index,
            contacts: bucket
          };
        })
        .filter(function (bucket) {
          return bucket != null;
        });
  }

});