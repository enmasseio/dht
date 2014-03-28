var assert = require('assert'),
    sha1 = require('sha1'),
    Id = require('../lib/Id'),
    Node = require('../lib/Node'),
    Contact = require('../lib/Contact');

describe('Contact', function() {

  it('should create a contact', function () {
    var node = new Node('test');

    var contact = new Contact(node.id, node);
    assert(contact instanceof Contact);
    assert(contact.id instanceof Id);
    assert.strictEqual(contact.node, node);
    assert.deepEqual(contact.id, node.id);
  });

  it('should throw an error when creating a Contact without new keyword', function () {
    assert.throws(function () {Contact()}, /Constructor must be called with the new operator/);
  });

  it('should ping a live contact', function (done) {
    var node = new Node('test');

    var contact = new Contact(node.id, node);

    contact.ping().then(function (alive) {
      assert.strictEqual(alive, true);
      done();
    });
  });

  it('should ping a dead contact', function (done) {
    var contact = new Contact(sha1('node1')); // no node specified

    contact.ping().then(function (alive) {
      assert.strictEqual(alive, false);
      done();
    });
  });

  it('should find a contact', function () {
    var node1 = new Node('node1');
    var node2 = new Node('node2');
    node1.onStoreNode(new Contact(node2.id, node2));
    
    var contact = new Contact(node1.id, node1);
    
    contact.findNode(node2.id).then(function (results) {
      assert.deepEqual(results, [new Contact(node2.id, node2)]);
    });
  });

  it('should throw an error when finding a value failed', function (done) {
    var contact = new Contact(sha1('node1')); // a contact without node

    contact.findNode(sha1('node2'))
        .catch(function (err) {
          assert(/Connection error/.test(err));
          done();
        });
  });

  it('should store a value', function (done) {
    var node1 = new Node('node1');
    var contact = new Contact(node1.id, node1);

    var key = Id.create('foo');
    var value = 'bar';

    contact.storeValue(key, value)
        .then(function () {
          assert.equal(Object.keys(node1.values).length, 1);
          assert.equal(node1.values[key], 'bar');

          done();
        });
  });

  it('should throw an error when storing a value failed', function (done) {
    var contact = new Contact(sha1('node1')); // a contact without node

    var key = Id.create('foo');
    var value = 'bar';

    contact.storeValue(key, value)
        .catch(function (err) {
          assert(/Connection error/.test(err));
          done();
        });
  });

});
