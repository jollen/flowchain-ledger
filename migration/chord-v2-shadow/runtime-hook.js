'use strict';

var Chord = require('../../p2p/libs/message');
var resolveRuntimeObserver = require('./runtime-bridge').resolveRuntimeObserver;

function swallowAsync(result) {
  if (result && typeof result.then === 'function' && typeof result.catch === 'function') {
    result.catch(function() {});
  }
}

function emitNonBlocking(node, event) {
  try {
    var observer = resolveRuntimeObserver(node);
    if (typeof observer !== 'function') return false;
    swallowAsync(observer(event));
    return true;
  } catch (error) {
    return false;
  }
}

function classifyOperation(message) {
  if (message && message.data && message.data.origin && message.data.key) return 'read';
  return 'save';
}

function installRuntimeHook(Node) {
  if (!Node || !Node.prototype || typeof Node.prototype.dispatch !== 'function') {
    throw new TypeError('Chord Node class with dispatch() is required');
  }
  if (Node.prototype.__chordV2ShadowInstalled) return Node;

  var originalDispatch = Node.prototype.dispatch;

  Node.prototype.dispatch = function(from, message) {
    if (message && message.type === Chord.FOUND_SUCCESSOR && message.hasOwnProperty('data')) {
      emitNonBlocking(this, {
        schemaVersion: 1,
        source: 'legacy-found-successor',
        operation: classifyOperation(message),
        key: message.id,
        legacyOwnerId: from && from.id,
        startId: this.id,
        observedAt: new Date().toISOString()
      });
    }

    return originalDispatch.apply(this, arguments);
  };

  Node.prototype.__chordV2ShadowInstalled = true;
  Node.prototype.__chordV2ShadowOriginalDispatch = originalDispatch;
  return Node;
}

module.exports = {
  installRuntimeHook: installRuntimeHook,
  emitNonBlocking: emitNonBlocking,
  classifyOperation: classifyOperation
};
