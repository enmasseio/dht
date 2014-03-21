var assert = require('assert'),
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

  it('should store a node connection in the right bucket', function () {
    var node1 = new Node('node1');

    var id2 = util.key('node2');
    var contact2 = new Contact(id2);
    var index2 = util.bucketIndex(node1.id, id2);
    assert.equal(index2, 159);

    node1.storeContact(contact2);
    assert.deepEqual(node1.buckets[index2], [contact2]);

    var id3 = util.key('node3');
    var contact3 = new Contact(id3);
    var index3 = util.bucketIndex(node1.id, id3);
    assert.equal(index3, 158);

    node1.storeContact(contact3);
    assert.deepEqual(node1.buckets[index3], [contact3]);
  });

  it('should store an existing contact only once', function () {
    var node1 = new Node('node1');

    var id2 = util.key('node2');
    var contact2 = new Contact(id2);
    var index2 = util.bucketIndex(node1.id, id2);
    assert.equal(index2, 159);

    node1.storeContact(contact2);
    assert.deepEqual(node1.buckets[index2], [contact2]);

    // storing again should leave the bucket as it is
    node1.storeContact(contact2);
    assert.deepEqual(node1.buckets[index2], [contact2]);
  });

  it('should move latest active contacts to the buckets tail', function () {
    var node1 = new Node('node1');

    // create two contacts with the same bucket index
    var id3 = util.key('node3');
    var contact3 = new Contact(id3);
    var index3 = util.bucketIndex(node1.id, id3);
    assert.equal(index3, 158);

    var id4 = util.key('node4');
    var contact4 = new Contact(id4);
    var index4 = util.bucketIndex(node1.id, id4);
    assert.equal(index4, 158);

    node1.storeContact(contact3);
    assert.deepEqual(node1.buckets[158], [contact3]);

    node1.storeContact(contact4);
    assert.deepEqual(node1.buckets[158], [contact3, contact4]);

    node1.storeContact(contact3);
    assert.deepEqual(node1.buckets[158], [contact4, contact3]);

    node1.storeContact(contact3);
    assert.deepEqual(node1.buckets[158], [contact4, contact3]);

    node1.storeContact(contact4);
    assert.deepEqual(node1.buckets[158], [contact3, contact4]);
  });

  it('should not replace existing, alive contact for new contact when the bucket is full', function () {
    var node1 = new Node('node1');

    var node2 = new Node('node2');
    var contact2 = new Contact(node2.id, node2);
    var index2 = util.bucketIndex(node1.id, node2.id);
    assert.equal(index2, 159);

    // create two contacts with the same bucket index
    for (var i = 0; i < 50; i++) {
      var node = new Node('node' + (i + 3));
      var contact = new Contact(node.id, node);
      node1.storeContact(contact);
    }

    var bucket = node1.buckets[index2];
    assert.equal(bucket && bucket.length, 20, 'Bucket ' + index2 + ' of node2 should be filled for this test');

    var leastSeen = bucket[0];

    node1.storeContact(contact2);

    // node2 should not be added, leastSeen should be moved to tail
    assert.deepEqual(bucket[bucket.length - 1], leastSeen);
  });

  it('should replace existing, dead contact for a new contact when the bucket is full', function () {
    var node1 = new Node('node1');

    var node2 = new Node('node2');
    var contact2 = new Contact(node2.id, node2);
    var index2 = util.bucketIndex(node1.id, node2.id);
    assert.equal(index2, 159);

    // create two contacts with the same bucket index
    for (var i = 0; i < 50; i++) {
      var node = new Node('node' + (i + 3));
      var contact = new Contact(node.id, node);
      node1.storeContact(contact);
    }

    var bucket = node1.buckets[index2];
    assert.equal(bucket && bucket.length, 20, 'Bucket ' + index2 + ' of node2 should be filled for this test');

    // change the leastSeen to dead
    var leastSeen = bucket[0];
    leastSeen.node.leave();

    node1.storeContact(contact2);

    // node2 should be added, leastSeen should be removed
    assert.deepEqual(bucket[bucket.length - 1], contact2);
  });

  it.skip('should find a node', function () {

  });

  it.skip('should find a value', function () {

  });

  it('should reply to a ping', function () {
    var node1 = new Node('node1');
    assert.strictEqual(node1.onPing(), true);
  });

  it.skip('should join a network', function () {

  });

  it.skip('should join and leave a network', function () {

  });

});