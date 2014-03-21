var assert = require('assert'),
    Node = require('../lib/Node'),
    Contact = require('../lib/Contact');

describe('Contact', function() {

  it('should create a contact', function () {
    var node = new Node('test');

    var contact = new Contact(node.id, node);
    assert(contact instanceof Contact);
    assert.strictEqual(contact.node, node);
    assert.deepEqual(contact.id, node.id);
  });

  it('should throw an error when creating a Contact without new keyword', function () {
    assert.throws(function () {Contact()}, /Constructor must be called with the new operator/);
  });

});