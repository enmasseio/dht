var assert = require('assert'),
    util = require('../lib/util');

describe('util', function() {

  it('should generate a key', function () {
    var ids = [
      'key',
      'other key',
      'and yet another key'
    ];

    ids.forEach(function (id) {
      var key = util.key(id);

      assert(Array.isArray(key));
      assert.equal(key.length, 20);
      key.forEach(function (byte) {
        assert(typeof byte === 'number');
        assert(byte >= 0x00);
        assert(byte <= 0xFF);
      });
    });
  });

  it('should calculate the distance between two keys', function () {
    var key1 = util.key('key'),
        key2;

    assert.deepEqual(key1, [166,47,34,37,191,112,191,172,203,199,241,239,42,57,120,54,113,115,119,222]);

    assert.deepEqual(util.distance(key1, key1), [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]);

    key2 = util.key('key'); key2[19] += 1;
    assert.deepEqual(util.distance(key1, key2), [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1]);

    key2 = util.key('key'); key2[19] += 2;
    assert.deepEqual(util.distance(key1, key2), [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,62]);

    key2 = util.key('key'); key2[18] += 20;
    assert.deepEqual(util.distance(key1, key2), [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,252,0]);

    key2 = util.key('key'); key2[0] += 10;
    assert.deepEqual(util.distance(key1, key2), [22,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]);
  });

  it('should compare two keys', function () {
    assert.equal(util.compare([2, 2, 2], [2, 2, 2]), 0);
    assert.equal(util.compare([2, 2, 3], [2, 2, 2]), 1);
    assert.equal(util.compare([2, 2, 1], [2, 2, 2]), -1);
    assert.equal(util.compare([2, 2, 2], [2, 2, 3]), -1);
    assert.equal(util.compare([2, 2, 2], [2, 2, 1]), 1);

    assert.equal(util.compare([8], [2]), 1);
    assert.equal(util.compare([2], [8]), -1);
    assert.equal(util.compare([8], [8]), 0);

    assert.equal(util.compare([], []), 0);
  });

  it('should calculate the bucket index for two keys', function () {
    var key1 = util.key('key'),
        key2;

    assert.deepEqual(key1, [166,47,34,37,191,112,191,172,203,199,241,239,42,57,120,54,113,115,119,222]);

    assert.deepEqual(util.bucketIndex(key1, key1), 0);

    key2 = util.key('key'); key2[19] += 1;
    assert.deepEqual(util.bucketIndex(key1, key2), 0);

    key2 = util.key('key'); key2[19] += 2;
    assert.deepEqual(util.bucketIndex(key1, key2), 5);

    key2 = util.key('key'); key2[18] += 20;
    assert.deepEqual(util.bucketIndex(key1, key2), 15);

    key2 = util.key('key'); key2[0] += 10;
    assert.deepEqual(util.bucketIndex(key1, key2), 156);
  });

});
