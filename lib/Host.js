var dgram = require('dgram'), // http://nodejs.org/api/dgram.html
    uuid = require('node-uuid');

/**
 * A Host opens an UDP socket on given ip address and port.
 * It can handle RPC messages.
 * @param {string} address        IP address for the host, for example '127.0.0.1'
 * @param {number} port           Port number for the host, for example 33333
 * @param {string} [type='udp4']  Socket type, can be 'udp4' (default) or 'udp6'
 * @constructor
 */
function Host(address, port, type) {
  if (typeof address !== 'string') throw new TypeError('Parameter address must be a string');
  if (typeof port !== 'number')    throw new TypeError('Parameter port must be a number');
  if (type != undefined && type !== 'udp4' && type !== 'udp6') {
    throw new TypeError('Parameter type can be "udp4" or "udp6"');
  }

  this.address = address;
  this.port = port;
  this.type = type || 'udp4';

  this.listeners = {};
  this.queue = {}; // queue containing callbacks of sent requests

  this.socket = dgram.createSocket(this.type);
  this.socket.on('message', this.receive.bind(this));
}

/**
 * Open the configured socket and start listening on configured address and port.
 * @param {Function} [callback] Callback invoked when binding socket is opened.
 *                              Invoked without parameters.
 */
Host.prototype.open = function (callback) {
  this.socket.bind(this.port, this.address, callback);
};

/**
 * Close the host's socket, stops listening on the configured port.
 */
Host.prototype.close = function () {
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
Host.prototype.on = function (message, listener) {
  if (message in this.listeners) {
    throw new Error('Listener for message ' + message + ' already registered');
  }

  this.listeners[message] = listener;
};

/**
 * Remove a listener of specified message
 * @param {string} message    A message name
 */
Host.prototype.off = function (message) {
  delete this.listeners[message];
};

/**
 * Send an RPC message and receive the result.
 * @param {{id: string | undefined, method: string, params: * | null} | {id: string, result: *, error: *}} rpc
 * @param {{address: string, port: number}} recipient Object containing the
 *                                                    IP address and port of the
 *                                                    recipient.
 * @param {Function} [callback]                       Function will be invoked
 *                                                    containing the result,
 *                                                    and is called as callback(err, result)
 */
// TODO: change send to promise based API
Host.prototype.send = function (rpc, recipient, callback) {
  // send a message containing an RPC request like {id: string, method: string, params: *}

  // add an id when missing in the message
  var id = rpc.id;
  if (!id) {
    id = uuid.v4();
    rpc.id = id;
  }

  // TODO: add a timeout? or is this already handled by the
  if (typeof callback === 'function') {
    this.queue[id] = callback;
  }

  var me = this;
  var message = new Buffer(JSON.stringify(rpc));
  this.socket.send(message, 0, message.length, recipient.port, recipient.address, function(err, bytes) {
    if (err) {
      delete me.queue[id];

      // TODO: handle errors
      throw err;
    }
  });
};

/**
 * Receive a message
 * @param {String} message   Message containing a stringified JSON RPC request or response
 * @param {{id: string}} sender
 */
Host.prototype.receive = function (message, sender) {
  var rpc = JSON.parse(message);
  if ('method' in rpc) {
    // this is a request
    // message contains an RPC request like {id: string, method: string, params: *}
    this._receiveRequest(rpc, sender);
  }
  else {
    // this is a response
    // message contains an RPC response like {id: string, result: * | null, error: * | null}
    this._receiveResponse(rpc);
  }
}

/**
 * Receive an RPC request, invoke according listener (if any), then send the
 * result back.
 * @param {{id: *, method: string, params: * | null}} request
 * @param {{address: string, port: number}} sender    Sender
 * @private
 */
Host.prototype._receiveRequest = function (request, sender) {
  var me = this;
  var listener = this.listeners[request.method];

  function callback(error, result) {
    // send a response
    // response is an RPC response like {id: string, result: * | null, error: * | null}
    var response = {
      id: request.id,
      error: error ? error.toString() : null,
      result: result || null
    };

    me.send(response, sender);
  }

  try {
    // invoke the message listener
    if (listener) {
      listener(sender, request.method, request.params || null, callback);
    }
    else {
      console.log('UNKNOWN METHOD', request.method, 'Available:', Object.keys(this.listeners))

      callback(new Error('Unknown method ' + request.method), null);
    }
  }
  catch (err) {
    callback(err, null);
  }
};

/**
 * Receive an RPC response, invoke the stored callback message with the result.
 * @param {{id: *, result: * | null, error: * | null}} response
 * @private
 */
Host.prototype._receiveResponse = function (response) {
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

module.exports = Host;
