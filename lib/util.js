var Id = require('./Id');

/**
 * Calculate the distance between two sha1 hashes (id1 XOR id2).
 * Both keys must have the same length.
 * @param {Id} id1   A byte array
 * @param {Id} id2   A byte array
 * @returns {Number[]} A byte array with the difference between the two keys.
 */
exports.distance = function distance (id1, id2) {
  var dist = [];

  for( var i = 0, ii = id1.bytes.length; i < ii; i++) {
    dist[i] = id1.bytes[i] ^ id2.bytes[i];
  }

  return dist;
};

/**
 * Compare two id's. Both keys must have the same length.
 * @param {Number[]} id1   A byte array
 * @param {Number[]} id2   A byte array
 * @returns {Number} Returns 0 if equal, returns -1 if id1 is smaller than id2,
 *                   returns 1 if id1 is larger than id2
 */
exports.compare = function(id1, id2) {
  for (var i = 0, ii = id1.length; i < ii; i++) {
    if(id1[i] < id2[i]) return -1;
    if(id1[i] > id2[i]) return  1;
  }

  return 0;
};

/**
 * Sort an array with objects by the distance of their id
 * @param {Array.<{id:Id}>}             array An array with objects, each having
 *                                      a property `id` containing an Id
 * @param {Id} id                       Id from which to calculate the distance
 * @param {String} [property='id']      Optional name of the property which
 *                                      contains the objects id.
 */
exports.sortByDistance = function sortByDistance (array, id, property) {
  property = property || 'id';

  // TODO: improve performance by caching the distances
  array.sort(function (a, b) {
      return exports.compare(
          exports.distance(id, a[property]),
          exports.distance(id, b[property]));
    });
};

/**
 * Calculate the k-bucket index for a given difference between two keys:
 * the index of the first differing bit. Both keys must have the same length.
 * @param {Id} id1
 * @param {Id} id2
 * @return {Number} Bucket index
 */
exports.bucketIndex = function bucketIndex(id1, id2) {
  // from https://github.com/nikhilm/kademlia/blob/master/lib/util.js
  var d = exports.distance(id1, id2);
  var len = d.length;
  var index = len * 8; // start at the maximum number of bits

  for (var i = 0; i < len; i++) {
    var byte = d[i];
    if (byte == 0) {
      index -= 8;
    }
    else {
      for (var j = 0; j < 8; j++) {
        if (byte & (0x80 >> j)) {
          return --index;
        }

        index--;
      }
    }
  }

  return index;
};
