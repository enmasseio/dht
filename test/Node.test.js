var assert = require('assert'),
    Promise = require('bluebird'),
    util = require('../lib/util'),
    Node = require('../lib/Node'),
    Contact = require('../lib/Contact');

describe('Node', function() {

  it('should create a node', function () {
    var node = new Node('test');
    assert(node instanceof Node);
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

      var id2 = util.sha1('node2');
      var contact2 = new Contact(id2);
      var index2 = util.bucketIndex(node1.id, id2);
      assert.equal(index2, 159);

      var id3, contact3, index3;

      node1.onStoreContact(contact2)
          .then(function () {
            assert.deepEqual(node1.buckets[index2], [contact2]);
          })
          .then(function () {
            id3 = util.sha1('node3');
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

    it('should store an existing contact only once', function () {
      var node1 = new Node('node1');

      var id2 = util.sha1('node2');
      var contact2 = new Contact(id2);
      var index2 = util.bucketIndex(node1.id, id2);
      assert.equal(index2, 159);

      node1.onStoreContact(contact2);
      assert.deepEqual(node1.buckets[index2], [contact2]);

      // storing again should leave the bucket as it is
      node1.onStoreContact(contact2);
      assert.deepEqual(node1.buckets[index2], [contact2]);
    });

    it('should move latest active contacts to the buckets tail', function () {
      var node1 = new Node('node1');

      // create two contacts with the same bucket index
      var id3 = util.sha1('node3');
      var contact3 = new Contact(id3);
      var index3 = util.bucketIndex(node1.id, id3);
      assert.equal(index3, 158);

      var id4 = util.sha1('node4');
      var contact4 = new Contact(id4);
      var index4 = util.bucketIndex(node1.id, id4);
      assert.equal(index4, 158);

      node1.onStoreContact(contact3);
      assert.deepEqual(node1.buckets[158], [contact3]);

      node1.onStoreContact(contact4);
      assert.deepEqual(node1.buckets[158], [contact3, contact4]);

      node1.onStoreContact(contact3);
      assert.deepEqual(node1.buckets[158], [contact4, contact3]);

      node1.onStoreContact(contact3);
      assert.deepEqual(node1.buckets[158], [contact4, contact3]);

      node1.onStoreContact(contact4);
      assert.deepEqual(node1.buckets[158], [contact3, contact4]);
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
            leastSeen.node.leave();

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

  })
  
  describe('onFindContact', function () {
    var node1;

    before(function () {
      node1 = new Node('node1');

      // create two contacts with the same bucket index
      for (var i = 0; i < 1000; i++) {
        var node = new Node('node' + (i + 3));
        var contact = new Contact(node.id, node);
        node1.onStoreContact(contact);
      }

      // console.log(bucketsToJSON(node1.buckets));
    });

    it('should find the closest k contacts from a node having less than k contacts', function () {
      var node = new Node('node1');

      // node has no contacts
      var someId = util.sha1('someId');
      assert.equal(node.onFindContact(someId).length, 0);

      // node with one contact
      var contact = new Contact(util.sha1('node2'));
      node.onStoreContact(contact);
      assert.equal(node.onFindContact(someId).length, 1);
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
      var searchedNode = new Node('node100');
      var id = searchedNode.id;
      var contacts = node1.onFindContact(id);

      // do the search ourselves, see if it matches the returned results
      var allContacts = node1.buckets
          .reduce(function (prev, cur) {
            return prev.concat(cur);
          }).sort(function (a, b) {
            return util.compare(util.distance(id, a.id), util.distance(id, b.id));
          })
          .splice(0, 20);

      // see if we end up with the same results (but from a raw search
      assert.deepEqual(allContacts, contacts);
    });

  });

  it.skip('should find the closest k contacts in the network', function () {

  });

  it.skip('should find a value', function () {

  });

  describe('onPing', function () {

    it('should reply to a ping', function () {
      var node1 = new Node('node1');
      assert.strictEqual(node1.onPing(), true);
    });

  })

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