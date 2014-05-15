var assert = require('assert'),
    dgram = require('dgram'),
    freeport = require('freeport'),
    Host = require('../lib/Host');

describe('Host', function() {

  it('should create a host and receive a message', function (done) {
    function test(PORT) {
      var ADDRESS = '127.0.0.1';

      var host = new Host(ADDRESS, PORT);

      host.on('test', function (sender, method, params, callback) {
        assert.equal(method, 'test');
        assert.equal(params, 'hello world');

        host.close();

        done();
      });

      assert.equal(Object.keys(host.listeners).length, 1);
      assert('test' in host.listeners);

      host.open(function () {

        // try to send something to the host, see if it is alive
        var request = {
          id: 123,
          method: 'test',
          params: 'hello world'
        };
        var message = new Buffer(JSON.stringify(request));
        var client = dgram.createSocket('udp4');
        client.send(message, 0, message.length, PORT, ADDRESS, function(err, bytes) {
          if (err) throw err;
          client.close();
        });
      });
    }

    freeport(function (error, port) {
      test(port);
    })
  });

  it('should create two hosts and send a message', function (done) {
    function test(PORT1, PORT2) {
      var ADDRESS1 = '127.0.0.1',
          ADDRESS2 = '127.0.0.1';

      var host1 = new Host(ADDRESS1, PORT1);
      var host2 = new Host(ADDRESS2, PORT2);

      host1.on('add', function (sender, method, params, callback) {
        assert.equal(method, 'add');
        assert.deepEqual(params, {a: 2, b: 3});

        var error = null,
            result = params.a + params.b;
        callback(error, result);
      });

      host1.open(function () {
        host2.open(function () {
          var rpc = {
            method: 'add',
            params: {a: 2, b: 3}
          };
          host2.send(rpc, {address: ADDRESS1, port: PORT1}, function (error, result) {
            assert.equal(error, null);
            assert.equal(result, 5);

            host1.close();
            host2.close();

            done();
          })
        });
      });
    }

    freeport(function (error, port1) {
      freeport(function (error, port2) {
        test(port1, port2);
      })
    });
  });

  // TODO: extensively test Host

});
