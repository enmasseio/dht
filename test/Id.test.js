var sha1 = require('sha1');
/*


 it('should convert sha1 string to a byte array', function () {
 var string = util.sha1String('key');
 assert.equal(string, 'a62f2225bf70bfaccbc7f1ef2a397836717377de');

 var array = util.sha1ToArray(string);
 assert.deepEqual(array, [166,47,34,37,191,112,191,172,203,199,241,239,42,57,120,54,113,115,119,222]);
 });

 it('should convert sha1 byte array to a string', function () {
 var array = sha1('key');
 assert.deepEqual(array, [166,47,34,37,191,112,191,172,203,199,241,239,42,57,120,54,113,115,119,222]);

 var string = util.sha1ToString(array);
 assert.equal(string, 'a62f2225bf70bfaccbc7f1ef2a397836717377de');
 });


 */

var assert = require('assert'),
    Id = require('../lib/Id');

describe('Id', function() {

  it('should create an Id from string', function () {
    var string = sha1('key');
    assert.equal(string, 'a62f2225bf70bfaccbc7f1ef2a397836717377de');

    var id = new Id(string);

    assert.equal(id.toString(), 'a62f2225bf70bfaccbc7f1ef2a397836717377de');
    assert.deepEqual(id.bytes, [166,47,34,37,191,112,191,172,203,199,241,239,42,57,120,54,113,115,119,222]);
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

});
