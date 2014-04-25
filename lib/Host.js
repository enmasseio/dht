var dgram = require('dgram'), // http://nodejs.org/api/dgram.html
    uuid = require('node-uuid');

/**
 * A Host opens an UDP socket on given ip address and port.
 * It can handle RPC messages.
 * @param {string} address        IP address for the host, for example '127.0.0.1'
 * @param {number} port           Port number for the host, for example 33333
 * @param {string} [type='udp4']  Socket type, can be 'udp4' or 'udp6'
 * @constructor
 */
function Host(address, port, type) {
  var me = this;

  this.address = address;
  this.port = port;
  this.type = type || 'udp4';

  this.listeners = {};
  this.queue = {}; // queue containing callbacks of sent requests

  this.socket = dgram.createSocket(this.type);
  this.socket.on('message', function (message, info) {
    var rpc = JSON.parse(message);
    if ('method' in rpc) {
      // this is a request
      // message contains an RPC request like {id: string, method: string, params: *}
      me._receiveRequest(rpc, info);
    }
    else {
      // this is a response
      // message contains an RPC response like {id: string, result: * | null, error: * | null}
      me._receiveResponse(rpc);
    }
  });
}

/**
 * Receive an RPC request, invoke according listener (if any), then send the
 * result back.
 * @param {{id: *, method: string, params: * | null}} request
 * @param {{address: string, port: number}} info      Information containing sender
 * @private
 */
Host.prototype._receiveRequest = function _receiveRequest(request, info) {
  var me = this;

  var listener = this.listeners[request.method];
  if (listener) {
    var sender = {
      address: info.address,
      port: info.port
    };

    function callback(error, result) {
      // send a response
      // response is an RPC response like {id: string, result: * | null, error: * | null}
      var response = {
        id: request.id,
        error: error || null,
        result: result || null
      };

      var message = new Buffer(JSON.stringify(response));
      me.socket.send(message, 0, message.length, sender.port, sender.address, function(err, bytes) {
        if (err) throw err; // TODO: handle errors
      });
    }

    try {
      // invoke the message listener
      listener(sender, request.method, request.params || null, callback);
    }
    catch (err) {
      callback(err, null);
    }
  }
};

/**
 * Receive an RPC response, invoke the stored callback message with the result.
 * @param {{id: *, result: * | null, error: * | null}} response
 * @private
 */
Host.prototype._receiveResponse = function _receiveResponse(response) {
  var callback = this.queue[response.id];
  if (callback) {
    delete this.queue[response.id];

    try {
      callback(response.error, response.result);
    }
    catch (err) {
      // TODO: handle error
    }
  }
};

/**
 * Open the configured socket and start listening on configured address and port.
 * @param {Function} [callback] Callback invoked when binding socket is opened.
 *                              Invoked without parameters.
 */
Host.prototype.open = function open(callback) {
  this.socket.bind(this.port, this.address, callback);
};

/**
 * Close the host's socket, stops listening on the configured port.
 */
Host.prototype.close = function close() {
  this.socket.close();
};

/**
 * Receive an RPC message and send a result
 * @param {string} message      A message name
 * @param {Function} listener   Callback is invoked as
 *                                  listener(sender: {address: string, port: number}, method: string, params: * | null, callback: Function)
 *                              callback must be invoked by the listener as
 *                                  callback(err: * | null, result: * | null)
 */
Host.prototype.on = function on(message, listener) {
  if (message in this.listeners) {
    throw new Error('Listener for message ' + message + ' already registered');
  }

  this.listeners[message] = listener;
};

/**
 * Remove a listener of specified message
 * @param {string} message    A message name
 */
Host.prototype.off = function off(message) {
  delete this.listeners[message];
};


/**
 * Send an RPC message and receive the result.
 * @param {{address: string, port: number}} recipient Object containing the
 *                                                    IP address and port of the
 *                                                    recipient.
 * @param {string} method                             Method to be invoked
 * @param {*} [params=null]                           Optional method parameters
 * @param {Function} callback                         Function will be invoked
 *                                                    containing the result,
 *                                                    and is called as callback(err, result)
 */
Host.prototype.send = function send(recipient, method, params, callback) {
  // send a message containing an RPC request like {id: string, method: string, params: *}
  var me = this,
      id = uuid.v4(),
      request = {
        id: id,
        method: method,
        params: params || null
      };

  // TODO: add a timeout? or is this already handled by the
  if (typeof callback === 'function') {
    this.queue[id] = callback;
  }

  var message = new Buffer(JSON.stringify(request));
  this.socket.send(message, 0, message.length, recipient.port, recipient.address, function(err, bytes) {
    if (err) {
      delete me.queue[id];

      // TODO: handle errors
      throw err;
    }
  });
};

module.exports = Host;
