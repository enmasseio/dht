var uuid = require('node-uuid'),
    Host = require('./Host');

// a singleton list with all local hosts
var hosts = {};

/**
 * Create a local host which immediately invokes local nodes which are connected
 * @param {String} id
 * @constructor
 */
function LocalHost(id) {
  this.id = id;

  this.listeners = {};
  this.queue = {}; // queue containing callbacks of sent requests
}

LocalHost.prototype = Object.create(Host.prototype);

/**
 * Open the local host
 * @param {Function} [callback] Callback invoked when the local host is opened.
 *                              Invoked without parameters.
 */
LocalHost.prototype.open = function (callback) {
  hosts[this.id] = this;
  process.nextTick(callback);
};

/**
 * Close the host
 */
LocalHost.prototype.close = function () {
  delete hosts[this.id];
};

/**
 * Send an RPC message and receive the result.
 * @param {{id: string, method: string: params: * | null} | {id: string, result: *, error: *}} rpc
 * @param {{id: string}} recipient Object containing the id of the recipient,
 *                                 an other LocalHost
 * @param {Function} callback      Function will be invoked
 *                                 containing the result,
 *                                 and is called as callback(err, result)
 */
// TODO: change send to promise based API
LocalHost.prototype.send = function (rpc, recipient, callback) {
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

  var receiver = hosts[recipient.id];
  if (receiver) {
    receiver.receive(JSON.stringify(rpc), {id: this.id});
  }
  else {
    callback(new Error('Recipient not found'), null);
  }
};

/**
 * Receive a message
 * @param {String} message   Message containing a stringified JSON RPC request or response
 * @param {{id: string}} sender
 */
LocalHost.prototype.receive = function (message, sender) {
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
};

module.exports = LocalHost;
