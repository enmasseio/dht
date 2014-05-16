var assert = require('assert'),
    sha1 = require('sha1'),
    Id = require('../lib/Id'),
    Contact = require('../lib/Contact');

describe('Contact', function() {

  it('should create a contact', function () {
    var id = sha1('key');
    assert.strictEqual(id, 'a62f2225bf70bfaccbc7f1ef2a397836717377de');
    var contact = new Contact({id: id, address: '127.0.0.1', port: 3000});

    assert(contact instanceof Contact);
    assert(contact.id instanceof Id);
    assert.deepEqual(contact.id.bytes, [166,47,34,37,191,112,191,172,203,199,241,239,42,57,120,54,113,115,119,222]);
    assert.equal(contact.address, '127.0.0.1');
    assert.equal(contact.port, 3000);
  });

  it('should create a contact with just an id', function () {
    var id = sha1('key');
    assert.strictEqual(id, 'a62f2225bf70bfaccbc7f1ef2a397836717377de');
    var contact = new Contact({id: id});

    assert(contact instanceof Contact);
    assert(contact.id instanceof Id);
    assert.deepEqual(contact.id.bytes, [166,47,34,37,191,112,191,172,203,199,241,239,42,57,120,54,113,115,119,222]);
    assert.equal(contact.address, null);
    assert.equal(contact.port, null);
  });

  it('should convert a contact to JSON', function () {
    var id = sha1('key');
    assert.strictEqual(id, 'a62f2225bf70bfaccbc7f1ef2a397836717377de');
    var contact = new Contact({id: id, address: '127.0.0.1', port: 3000});

    var json = contact.toJSON();
    assert.deepEqual(json, {id: id, address: '127.0.0.1', port: 3000});
  });

  it('should convert a contact with just an id to JSON', function () {
    var id = sha1('key');
    assert.strictEqual(id, 'a62f2225bf70bfaccbc7f1ef2a397836717377de');
    var contact = new Contact({id: id});

    var json = contact.toJSON();
    assert.deepEqual(json, {id: id, address: null, port: null});
  });

  it('should throw an error when created without the new keyword', function () {
    assert.throws(function () {
      Contact({id: sha1('key'), address: '127.0.0.1', port: 3000});
    })
  });

});
