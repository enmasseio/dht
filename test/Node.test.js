var assert = require('assert'),
    sha1 = require('sha1'),
    Promise = require('bluebird'),
    util = require('../lib/util'),
    Node = require('../lib/Node'),
    Id = require('../lib/Id'),
    Contact = require('../lib/Contact');

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

  describe('onStoreContact', function () {

    it('should store a node connection in the right bucket', function (done) {
      var node1 = new Node('node1');

      var id2 = Id.create('node2');
      var contact2 = new Contact(id2);
      var index2 = util.bucketIndex(node1.id, id2);
      assert.equal(index2, 159);

      var id3, contact3, index3;

      node1.onStoreContact(contact2)
          .then(function () {
            assert.deepEqual(node1.buckets[index2], [contact2]);
          })
          .then(function () {
            id3 = new Id(sha1('node3'));
            contact3 = new Contact(id3);
            index3 = util.bucketIndex(node1.id, id3);
            assert.equal(index3, 158);

            return node1.onStoreContact(contact3);
          })
          .then(function () {
            assert.deepEqual(node1.buckets[index3], [contact3]);
            done();
          });

    });

    it('should store an existing contact only once', function (done) {
      var node1 = new Node('node1');

      var id2 = new Id(sha1('node2'));
      var contact2 = new Contact(id2);
      var index2 = util.bucketIndex(node1.id, id2);
      assert.equal(index2, 159);

      node1.onStoreContact(contact2)
          .then(function () {
            assert.deepEqual(node1.buckets[index2], [contact2]);
          })

          .then(function() {
            // storing again should leave the bucket as it is
            return node1.onStoreContact(contact2);
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
      var contact3 = new Contact(id3);
      var index3 = util.bucketIndex(node1.id, id3);
      assert.equal(index3, 158);

      var id4 = new Id(sha1('node4'));
      var contact4 = new Contact(id4);
      var index4 = util.bucketIndex(node1.id, id4);
      assert.equal(index4, 158);

      node1.onStoreContact(contact3)
          .then(function () { assert.deepEqual(node1.buckets[158], [contact3]); })

          .then(function () { return node1.onStoreContact(contact4); })
          .then(function () {assert.deepEqual(node1.buckets[158], [contact3, contact4]); })

          .then(function () { return node1.onStoreContact(contact3); })
          .then(function () {assert.deepEqual(node1.buckets[158], [contact4, contact3]); })

          .then(function () { return node1.onStoreContact(contact3); })
          .then(function () {assert.deepEqual(node1.buckets[158], [contact4, contact3]); })

          .then(function () { return node1.onStoreContact(contact4); })
          .then(function () {assert.deepEqual(node1.buckets[158], [contact3, contact4]); })

          .then(function () {
            done();
          })
    });

    it('should not replace existing, alive contact for new contact when the bucket is full', function (done) {
      var node1 = new Node('node1');

      var node2 = new Node('node2');
      var contact2 = new Contact(node2.id, node2);
      var index2 = util.bucketIndex(node1.id, node2.id);
      assert.equal(index2, 159);

      // create a lot of contacts
      var contacts = [];
      for (var i = 0; i < 50; i++) {
        var node = new Node('node' + (i + 3));
        var contact = new Contact(node.id, node);
        contacts.push(contact);
      }

      var bucket, leastSeen;
      Promise
          .map(contacts, function (contact) {
            return node1.onStoreContact(contact);
          })
          .then(function () {
            bucket = node1.buckets[index2];
            assert.equal(bucket && bucket.length, 20, 'Bucket ' + index2 + ' of node2 should be filled for this test');

            leastSeen = bucket[0];

            return node1.onStoreContact(contact2);
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
      var contact2 = new Contact(node2.id, node2);
      var index2 = util.bucketIndex(node1.id, node2.id);
      assert.equal(index2, 159);

      // create a lot of contacts
      var contacts = [];
      for (var i = 0; i < 50; i++) {
        var node = new Node('node' + (i + 3));
        var contact = new Contact(node.id, node);
        contacts.push(contact);
      }

      var bucket;
      Promise
          .map(contacts, function (contact) {
            return node1.onStoreContact(contact);
          })
          .then(function () {
            bucket = node1.buckets[index2];
            assert.equal(bucket && bucket.length, 20, 'Bucket ' + index2 + ' of node2 should be filled for this test');

            // change the leastSeen to dead
            var leastSeen = bucket[0];
            delete leastSeen.node;

            return node1.onStoreContact(contact2);
          })
          .then(function () {
            // node2 should be added, leastSeen should be removed
            assert.deepEqual(bucket[bucket.length - 1], contact2);
            done();
          });
    });

    it('should throw an error when storing a non-contact as contact', function (done) {
      var node1 = new Node('node1');

      var errs = [];
      node1.onStoreContact()
          .catch(function (err) {errs.push(err)})

          .then(function () {
            return node1.onStoreContact(2);
          })
          .catch(function (err) {errs.push(err)})

          .then(function () {
            return node1.onStoreContact({});
          })
          .catch(function (err) {errs.push(err)})

          .then(function () {
            assert.equal(errs.length, 3);

            errs.forEach(function (err) {
              assert(/Instance of contact expected as parameter contact/.test(err));
            });

            done();
          });
    });

  });
  
  describe('onFindContact', function () {
    var node1;

    before(function (done) {
      node1 = new Node('node1');

      // create two contacts with the same bucket index
      var contacts = [];
      for (var i = 0; i < 1000; i++) {
        var node = new Node('node' + (i + 3));
        var contact = new Contact(node.id, node);
        contacts.push(contact);
      }

      Promise
          .map(contacts, function (contact) {
            return node1.onStoreContact(contact);
          })
          .then(function () {
            done();
          });
    });

    it('should find the closest k contacts from a node having less than k contacts', function (done) {
      var node = new Node('node1');

      // node has no contacts
      var someId = new Id(sha1('someId'));
      assert.equal(node.onFindContact(someId).length, 0);

      // node with one contact
      var contact = new Contact(sha1('node2'));
      node.onStoreContact(contact).then(function () {
        assert.equal(node.onFindContact(someId).length, 1);
        done();
      });
    });

    it('should find the closest k contacts from a node from a filled bucket', function () {
      // pick one node from one of the buckets of node1 to search
      var theLuckyBucket = 158; // bucket 158 contains 20 contacts
      var searchedNode = node1.buckets[theLuckyBucket][10].node;

      var id = searchedNode.id;
      var index = util.bucketIndex(node1.id, id);
      assert.equal(index, theLuckyBucket);
      assert.equal(node1.buckets[index].length, 20,
          'Bucket with ' + theLuckyBucket + ' must be filled for this test');

      var contacts = node1.onFindContact(id);
      assert.equal(contacts.length, 20);
      assert.deepEqual(contacts[0].node, searchedNode);
    });

    it('should find the closest k contacts from a node, from a non-filled bucket', function () {
      // pick one node from one of the buckets of node1 to search
      var theLuckyBucket = 152; // bucket 152 contains 2 contacts
      var searchedNode = node1.buckets[theLuckyBucket][1].node;

      var id = searchedNode.id;
      var index = util.bucketIndex(node1.id, id);
      assert.equal(index, theLuckyBucket);
      assert.equal(node1.buckets[index].length, 2, 'huh? I thought bucket ' + theLuckyBucket + ' contained 2 nodes?');

      var contacts = node1.onFindContact(id);
      assert.equal(contacts.length, 20);
      assert.deepEqual(contacts[0].node, searchedNode);
    });

    it('should find the closest k contacts from a node which is not listed itself', function () {
      // node 100 is not listed in the contacts of node1
      var searchedNode = new Node('foo');
      var id = searchedNode.id;
      var contacts = node1.onFindContact(id);

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

    it('should find the closest k contacts to the nodes id itself', function () {
      // node 100 is not listed in the contacts of node1
      var id = node1.id;
      var contacts = node1.onFindContact(id);

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

  describe('findContact', function () {

    it('should find the closest k contacts in a network one level deep', function (done) {
      var node1 = new Node('node1');
      var node2 = new Node('node2');
      var node3 = new Node('node4');
      var contact1 = new Contact(node1.id, node1);
      var contact2 = new Contact(node2.id, node2);
      var contact3 = new Contact(node3.id, node3);

      Promise
          .all([
              node1.onStoreContact(contact2),
              node1.onStoreContact(contact3)
          ])

          // find node2
          .then(function () {
            return node1.findContact(sha1('node2'));
          })
          .then(function (contacts) {
            assert.deepEqual(contacts, [contact2, contact3, contact1]);
          })

          // find node4
          .then(function () {
            return node1.findContact(sha1('node4'));
          })
          .then(function (contacts) {
            assert.deepEqual(contacts, [contact3, contact1, contact2]);
          })

          .then(function () {
            done();
          });
    });

    it ('should find the closest k contacts in a network with one level deep and special outlier bucket', function (done) {
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
            var contact = new Contact(node.id, node);
            return node0.onStoreContact(contact);
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

            allContacts.push(new Contact(node0.id, node0));

            util.sortByDistance(allContacts, Id.create('foo'));
          })

          .then(function () {
            return node0.findContact(sha1('foo'));
          })
          .then(function (contacts) {
            assert.deepEqual(contacts, allContacts.slice(0, k));
          })

          .then(function () {
            done();
          });
    });

    it('should find the closest k contacts in a network two levels deep', function (done) {
      var node1 = new Node('node1');
      var node2 = new Node('node2');
      var node3 = new Node('node3');
      var contact1 = new Contact(node1.id, node1);
      var contact2 = new Contact(node2.id, node2);
      var contact3 = new Contact(node3.id, node3);

      Promise
          .all([
            node1.onStoreContact(contact2),
            node2.onStoreContact(contact3)
          ])

          // find node3 from node2
          .then(function () {
            return node2.findContact(sha1('node3'));
          })
          .then(function (contacts) {
            assert.deepEqual(contacts, [contact3, contact2]);
          })

          // find node2 from node1
          .then(function () {
            return node1.findContact(sha1('node2'));
          })
          .then(function (contacts) {
            assert.deepEqual(contacts, [contact2, contact3, contact1]);
          })

          // find node3 from node1
          .then(function () {
            return node1.findContact(sha1('node3'));
          })
          .then(function (contacts) {
            assert.deepEqual(contacts, [contact3, contact1, contact2]);
          })

          .then(function () {
            done();
          });
    });

    it.skip('should find the closest k contacts in a network n levels deep', function () {

    });

    it('should find the closest k contacts in a network with a dead node', function (done) {
      var node1 = new Node('node1');
      var node2 = new Node('node2');
      var contact1 = new Contact(node1.id, node1);
      var contact2 = new Contact(node2.id); // Note: no node specified! node2 is dead

      Promise
          .all([
            node1.onStoreContact(contact2)
          ])

          // find node2 from node1
          .then(function () {
            return node1.findContact(sha1('node2'));
          })
          .then(function (contacts) {
            assert.deepEqual(contacts, [contact1]); // must return only node1 as node2 is dead
          })

          .then(function () {
            done();
          });
    });

    it('should find the closest k contacts in a network with some dead nodes', function (done) {
      var node1 = new Node('node1');
      var node3 = new Node('node3');
      var contact1 = new Contact(node1.id, node1);
      var contact2 = new Contact(sha1('node2')); // Note: no node specified! node2 is dead
      var contact3 = new Contact(node3.id, node3);
      var contact4 = new Contact(sha1('node4')); // Note: no node specified! node4 is dead

      Promise
          .all([
            node1.onStoreContact(contact2),
            node1.onStoreContact(contact3),
            node3.onStoreContact(contact4)
          ])

          // find node4 from node1
          .then(function () {
            return node1.findContact(sha1('node4'));
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

    it ('should store a value on nodes in the network', function (done) {
      var node1 = new Node('node1');
      var node2 = new Node('node2');
      var node3 = new Node('node3');
      var contact1 = new Contact(node1.id, node1);
      var contact2 = new Contact(node2.id, node2);
      var contact3 = new Contact(node3.id, node3);

      Promise
          .all([
            node1.onStoreContact(contact2),
            node2.onStoreContact(contact3)
          ])

          .then(function () {
            return node1.storeValue(sha1('foo'), 'bar');
          })

          .then(function (contacts) {
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

    it ('should store a value in a network containing dead nodes', function (done) {
      var node1 = new Node('node1');
      var node2 = new Node('node2');
      var node4 = new Node('node4');
      var contact1 = new Contact(node1.id, node1);
      var contact2 = new Contact(node2.id, node2);
      var contact3 = new Contact(Id.create('node3')); // dead contact (no node specified)
      var contact4 = new Contact(node4.id, node4);
      var contact5 = new Contact(Id.create('node5')); // dead contact (no node specified)

      Promise
          .all([
            node1.onStoreContact(contact2),
            node1.onStoreContact(contact3),
            node2.onStoreContact(contact4),
            node2.onStoreContact(contact5)
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

    it ('should store a value on the k closest nodes of the network', function (done) {
      var node0 = new Node('node0');

      var nodes = [];
      for (var i = 1; i < 22; i++) { // TODO: change 22 to 50 or 100
        var nodeI = new Node('node' + i);
        nodes.push(nodeI);
      }

      var k = 20;
      var allContacts;

      Promise
          .map(nodes, function (node) {
            var contact = new Contact(node.id, node);
            return node0.onStoreContact(contact);
          })

          .then(function () {
            // node0 has not stored all contacts (only k per bucket)
            allContacts = node0.buckets
                .filter(function (bucket) {
                  return bucket;
                })
                .reduce(function (prev, cur) {
                  return prev.concat(cur);
                }, [new Contact(node0.id, node0)]);

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

  it.skip('should find a value', function () {

  });

  describe('onPing', function () {

    it('should reply to a ping', function () {
      var node1 = new Node('node1');
      assert.strictEqual(node1.onPing(), true);
    });

  });

  it.skip('should join a network', function () {

  });

  it.skip('should leave a network', function () {

  });

  function bucketsToJSON(buckets) {
    return buckets
        .map(function (bucket, index) {
          return {
            index: index,
            contacts: contactsToJSON(bucket)
          };
        })
        .filter(function (bucket) {
          return bucket != null;
        });
  }

  function contactsToJSON(contacts) {
    return contacts.map(contactToJSON);
  }

  function contactToJSON(contact) {
    return contact.node.name;
  }

});