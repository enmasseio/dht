var assert = require('assert'),
    sha1 = require('sha1'),
    Id = require('../lib/Id'),
    util = require('../lib/util');

describe('util', function() {

  it('should calculate the distance between two ids', function () {
    var id1 = new Id(sha1('key')),
        id2,
        s;

    assert.deepEqual(id1, {
      bytes: [166,47,34,37,191,112,191,172,203,199,241,239,42,57,120,54,113,115,119,222]
    });

    assert.deepEqual(util.distance(id1, id1), [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]);

    s = sha1('key', {asBytes: true}); s[19] += 1; id2 = new Id(s);
    assert.deepEqual(util.distance(id1, id2), [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1]);
    assert.deepEqual(util.distance(id2, id1), [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1]);

    s = sha1('key', {asBytes: true}); s[19] += 2; id2 = new Id(s);
    assert.deepEqual(util.distance(id1, id2), [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,62]);
    assert.deepEqual(util.distance(id2, id1), [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,62]);

    s = sha1('key', {asBytes: true}); s[18] += 20; id2 = new Id(s);
    assert.deepEqual(util.distance(id1, id2), [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,252,0]);
    assert.deepEqual(util.distance(id2, id1), [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,252,0]);

    s = sha1('key', {asBytes: true}); s[0] += 10; id2 = new Id(s);
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
    var id1 = new Id(sha1('key')),
        id2,
        s;

    assert.deepEqual(id1, {
      bytes: [166,47,34,37,191,112,191,172,203,199,241,239,42,57,120,54,113,115,119,222]
    });

    assert.deepEqual(util.bucketIndex(id1, id1), 0);

    s = sha1('key', {asBytes: true}); s[19] += 1; id2 = new Id(s);
    assert.deepEqual(util.bucketIndex(id1, id2), 0);

    s = sha1('key', {asBytes: true}); s[19] += 2; id2 = new Id(s);
    assert.deepEqual(util.bucketIndex(id1, id2), 5);

    s = sha1('key', {asBytes: true}); s[18] += 20; id2 = new Id(s);
    assert.deepEqual(util.bucketIndex(id1, id2), 15);

    s = sha1('key', {asBytes: true}); s[0] += 10; id2 = new Id(s);
    assert.deepEqual(util.bucketIndex(id1, id2), 156);
  });

  describe('sortByDistance', function () {

    it('should sort an array with objects by distance', function () {
      var array = [
        {id: new Id([2, 2, 2])},
        {id: new Id([2, 2, 4])},
        {id: new Id([2, 2, 1])}
      ];

      var id = new Id([2, 2, 0]);
      util.sortByDistance(array, id);
      assert.deepEqual(array, [
        {id: new Id([2, 2, 1])},
        {id: new Id([2, 2, 2])},
        {id: new Id([2, 2, 4])}
      ]);

      id = new Id([2, 2, 2]);
      util.sortByDistance(array, id);
      assert.deepEqual(array, [
        {id: new Id([2, 2, 2])},
        {id: new Id([2, 2, 1])},
        {id: new Id([2, 2, 4])}
      ]);
    });

    it('should sort an array with objects by distance of a custom property', function () {
      var id = new Id([2, 2, 0]);
      var array = [
        {_id: new Id([2, 2, 2])},
        {_id: new Id([2, 2, 4])},
        {_id: new Id([2, 2, 1])}
      ];

      // should throw an error as there is no property 'id'
      assert.throws(function () {util.sortByDistance(array, id);});

      util.sortByDistance(array, id, '_id');

      assert.deepEqual(array, [
        {_id: new Id([2, 2, 1])},
        {_id: new Id([2, 2, 2])},
        {_id: new Id([2, 2, 4])}
      ]);
    })

  });

});
