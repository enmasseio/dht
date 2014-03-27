var assert = require('assert'),
    util = require('../lib/util');

describe('util', function() {

  it('should generate an sha1 key as byte array', function () {
    var strings = [
      'key',
      'other key',
      'and yet another key'
    ];

    strings.forEach(function (strings) {
      var id = util.sha1(strings);

      assert(Array.isArray(id));
      assert.equal(id.length, 20);
      id.forEach(function (byte) {
        assert(typeof byte === 'number');
        assert(byte >= 0x00);
        assert(byte <= 0xFF);
      });
    });
  });

  it('should generate an sha1 key as string', function () {
    var strings = [
      'key',
      'other key',
      'and yet another key'
    ];

    strings.forEach(function (strings) {
      var id = util.sha1String(strings);

      assert(typeof id === 'string');
      assert.equal(id.length, 40);
    });
  });

  it('should convert sha1 string to a byte array', function () {
    var string = util.sha1String('key');
    assert.equal(string, 'a62f2225bf70bfaccbc7f1ef2a397836717377de');

    var array = util.sha1ToArray(string);
    assert.deepEqual(array, [166,47,34,37,191,112,191,172,203,199,241,239,42,57,120,54,113,115,119,222]);
  });

  it('should convert sha1 byte array to a string', function () {
    var array = util.sha1('key');
    assert.deepEqual(array, [166,47,34,37,191,112,191,172,203,199,241,239,42,57,120,54,113,115,119,222]);

    var string = util.sha1ToString(array);
    assert.equal(string, 'a62f2225bf70bfaccbc7f1ef2a397836717377de');
  });

  it('should calculate the distance between two ids', function () {
    var id1 = util.sha1('key'),
        id2;

    assert.deepEqual(id1, [166,47,34,37,191,112,191,172,203,199,241,239,42,57,120,54,113,115,119,222]);

    assert.deepEqual(util.distance(id1, id1), [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]);

    id2 = util.sha1('key'); id2[19] += 1;
    assert.deepEqual(util.distance(id1, id2), [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1]);
    assert.deepEqual(util.distance(id2, id1), [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1]);

    id2 = util.sha1('key'); id2[19] += 2;
    assert.deepEqual(util.distance(id1, id2), [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,62]);
    assert.deepEqual(util.distance(id2, id1), [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,62]);

    id2 = util.sha1('key'); id2[18] += 20;
    assert.deepEqual(util.distance(id1, id2), [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,252,0]);
    assert.deepEqual(util.distance(id2, id1), [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,252,0]);

    id2 = util.sha1('key'); id2[0] += 10;
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
    var id1 = util.sha1('key'),
        id2;

    assert.deepEqual(id1, [166,47,34,37,191,112,191,172,203,199,241,239,42,57,120,54,113,115,119,222]);

    assert.deepEqual(util.bucketIndex(id1, id1), 0);

    id2 = util.sha1('key'); id2[19] += 1;
    assert.deepEqual(util.bucketIndex(id1, id2), 0);

    id2 = util.sha1('key'); id2[19] += 2;
    assert.deepEqual(util.bucketIndex(id1, id2), 5);

    id2 = util.sha1('key'); id2[18] += 20;
    assert.deepEqual(util.bucketIndex(id1, id2), 15);

    id2 = util.sha1('key'); id2[0] += 10;
    assert.deepEqual(util.bucketIndex(id1, id2), 156);
  });

  describe('sortByDistance', function () {

    it('should sort an array with objects by distance', function () {
      var array = [
        {id: [2, 2, 2]},
        {id: [2, 2, 4]},
        {id: [2, 2, 1]}
      ]

      var id = [2, 2, 0];
      util.sortByDistance(array, id);
      assert.deepEqual(array, [
        {id: [2, 2, 1]},
        {id: [2, 2, 2]},
        {id: [2, 2, 4]}
      ]);

      id = [2, 2, 2];
      util.sortByDistance(array, id);
      assert.deepEqual(array, [
        {id: [2, 2, 2]},
        {id: [2, 2, 1]},
        {id: [2, 2, 4]}
      ]);
    });

    it('should sort an array with objects by distance of a custom property', function () {
      var id = [2, 2, 0];
      var array = [
        {_id: [2, 2, 2]},
        {_id: [2, 2, 4]},
        {_id: [2, 2, 1]}
      ]

      // should throw an error as there is no property 'id'
      assert.throws(function () {util.sortByDistance(array, id);});

      util.sortByDistance(array, id, '_id');

      assert.deepEqual(array, [
        {_id: [2, 2, 1]},
        {_id: [2, 2, 2]},
        {_id: [2, 2, 4]}
      ]);
    })

  });

});
