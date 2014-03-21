var assert = require('assert'),
    util = require('../lib/util');

describe('util', function() {

  it('should generate a key', function () {
    var strings = [
      'key',
      'other key',
      'and yet another key'
    ];

    strings.forEach(function (strings) {
      var id = util.id(strings);

      assert(Array.isArray(id));
      assert.equal(id.length, 20);
      id.forEach(function (byte) {
        assert(typeof byte === 'number');
        assert(byte >= 0x00);
        assert(byte <= 0xFF);
      });
    });
  });

  it('should calculate the distance between two ids', function () {
    var id1 = util.id('key'),
        id2;

    assert.deepEqual(id1, [166,47,34,37,191,112,191,172,203,199,241,239,42,57,120,54,113,115,119,222]);

    assert.deepEqual(util.distance(id1, id1), [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]);

    id2 = util.id('key'); id2[19] += 1;
    assert.deepEqual(util.distance(id1, id2), [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1]);
    assert.deepEqual(util.distance(id2, id1), [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1]);

    id2 = util.id('key'); id2[19] += 2;
    assert.deepEqual(util.distance(id1, id2), [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,62]);
    assert.deepEqual(util.distance(id2, id1), [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,62]);

    id2 = util.id('key'); id2[18] += 20;
    assert.deepEqual(util.distance(id1, id2), [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,252,0]);
    assert.deepEqual(util.distance(id2, id1), [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,252,0]);

    id2 = util.id('key'); id2[0] += 10;
    assert.deepEqual(util.distance(id1, id2), [22,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]);
    assert.deepEqual(util.distance(id2, id1), [22,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]);
  });

  it('should compare two ids', function () {
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

  it('should calculate the bucket index for two ids', function () {
    var id1 = util.id('key'),
        id2;

    assert.deepEqual(id1, [166,47,34,37,191,112,191,172,203,199,241,239,42,57,120,54,113,115,119,222]);

    assert.deepEqual(util.bucketIndex(id1, id1), 0);

    id2 = util.id('key'); id2[19] += 1;
    assert.deepEqual(util.bucketIndex(id1, id2), 0);

    id2 = util.id('key'); id2[19] += 2;
    assert.deepEqual(util.bucketIndex(id1, id2), 5);

    id2 = util.id('key'); id2[18] += 20;
    assert.deepEqual(util.bucketIndex(id1, id2), 15);

    id2 = util.id('key'); id2[0] += 10;
    assert.deepEqual(util.bucketIndex(id1, id2), 156);
  });

});
