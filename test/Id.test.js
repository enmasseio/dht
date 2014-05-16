var assert = require('assert'),
    sha1 = require('sha1'),
    Id = require('../lib/Id');

describe('Id', function() {

  it('should create an Id from string', function () {
    var string = sha1('key');
    assert.equal(string, 'a62f2225bf70bfaccbc7f1ef2a397836717377de');

    var id = new Id(string);

    assert.equal(id.toString(), 'a62f2225bf70bfaccbc7f1ef2a397836717377de');
    assert.deepEqual(id.bytes, [166,47,34,37,191,112,191,172,203,199,241,239,42,57,120,54,113,115,119,222]);
  });

  it('should create an Id containing a zero', function () {
    var id = new Id('00');
    assert.deepEqual(id.bytes, [0]);
    assert.equal(id.toString(), '00');

    var id2 = new Id([0]);
    assert.deepEqual(id2.bytes, [0]);
    assert.equal(id2.toString(), '00');
  });

  it('should create an Id from byte array', function () {
    var bytes = sha1('key', {asBytes: true});
    assert.deepEqual(bytes, [166,47,34,37,191,112,191,172,203,199,241,239,42,57,120,54,113,115,119,222]);

    var id = new Id(bytes);

    assert.deepEqual(id.bytes, [166,47,34,37,191,112,191,172,203,199,241,239,42,57,120,54,113,115,119,222]);
    assert.equal(id.toString(), 'a62f2225bf70bfaccbc7f1ef2a397836717377de');
  });

  it('should create an Id from a text', function () {
    var id = Id.create('key');

    assert.equal(id.toString(), 'a62f2225bf70bfaccbc7f1ef2a397836717377de');
    assert.deepEqual(id.bytes, [166,47,34,37,191,112,191,172,203,199,241,239,42,57,120,54,113,115,119,222]);
  });

  it('should stringify an Id', function () {
    var id1 = new Id(sha1('key', {asBytes: true}));
    assert.deepEqual(id1.toString(), 'a62f2225bf70bfaccbc7f1ef2a397836717377de');

    var id2 = new Id(sha1('key'));
    assert.deepEqual(id2.toString(), 'a62f2225bf70bfaccbc7f1ef2a397836717377de');
  });

  it('should convert an Id to JSON', function () {
    var id1 = new Id(sha1('key', {asBytes: true}));
    assert.deepEqual(id1.toJSON(), 'a62f2225bf70bfaccbc7f1ef2a397836717377de');

    var id2 = new Id(sha1('key'));
    assert.deepEqual(id2.toJSON(), 'a62f2225bf70bfaccbc7f1ef2a397836717377de');
  });

  it('should throw an error when the bytes are out of range', function () {
    var id1 = new Id(sha1('key', {asBytes: true}));
    assert.deepEqual(id1.toJSON(), 'a62f2225bf70bfaccbc7f1ef2a397836717377de');

    var id2 = new Id(sha1('key'));
    assert.deepEqual(id2.toJSON(), 'a62f2225bf70bfaccbc7f1ef2a397836717377de');
  });

});
