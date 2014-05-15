var assert = require('assert'),
    LocalHost = require('../lib/LocalHost');

describe('LocalHost', function() {

  it('should create a host and receive a message', function (done) {
      var host = new LocalHost('host1');

      host.on('test', function (sender, method, params, callback) {
        assert.equal(method, 'test');
        assert.equal(params, 'hello world');
        assert.deepEqual(sender, {id: 'fake'});

        host.close();

        done();
      });

      assert.equal(Object.keys(host.listeners).length, 1);
      assert('test' in host.listeners);

      host.open(function () {
        // try to send something to the host, see if it is alive
        var rpc = {
          method: 'test',
          params: 'hello world'
        };

        var message = JSON.stringify(rpc);
        var sender = {id: 'fake'};
        host.receive(message, sender);
      });
  });

  it('should create two hosts and send a message', function (done) {
    var host1 = new LocalHost('host1');
    var host2 = new LocalHost('host2');

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

        host2.send(rpc, {id: 'host1'}, function (error, result) {
          assert.equal(error, null);
          assert.equal(result, 5);

          host1.close();
          host2.close();

          done();
        })
      });
    });
  });

  // TODO: extensively test LocalHost

});
