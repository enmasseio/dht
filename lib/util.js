var sha1 = require('sha1');

/**
 * Convert an id into an SHA-1 key
 * @param {String} id
 * @return {Number[]} key    Returns a byte array with 20 bytes
 */
exports.key = function key (id) {
  return sha1(id, {
    asBytes: true
  });
};

/**
 * Calculate the distance between two sha1 hashes (key1 XOR key2).
 * Both keys must have the same length.
 * @param {Number[]} key1   A byte array
 * @param {Number[]} key2   A byte array
 * @returns {Number[]} A byte array with the difference between the two keys.
 */
exports.distance = function distance (key1, key2) {
  var dist = [];

  for( var i = 0, ii = key1.length; i < ii; i++) {
    dist[i] = key1[i] ^ key2[i];
  }

  return dist;
};

/**
 * Compare two keys. Both keys must have the same length.
 * @param {Number[]} key1   A byte array
 * @param {Number[]} key2   A byte array
 * @returns {Number} Returns 0 if equal, -1 if key1 < key2, 1 if key1 > key2
 */
exports.compare = function(key1, key2) {
  for (var i = 0, ii = key1.length; i < ii; i++) {
    if(key1[i] < key2[i]) return -1;
    if(key1[i] > key2[i]) return  1;
  }

  return 0;
};

/**
 * Calculate the k-bucket index for a given difference between two keys:
 * the index of the first differing bit. Both keys must have the same length.
 * @param {Number[]} key1   A byte array
 * @param {Number[]} key2   A byte array
 * @return {Number} Bucket index
 */
exports.bucketIndex = function bucketIndex(key1, key2) {
  // from https://github.com/nikhilm/kademlia/blob/master/lib/util.js
  var d = exports.distance(key1, key2);
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
