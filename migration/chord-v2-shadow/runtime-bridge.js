'use strict';

var ShadowObserver = require('./shadow-observer').ShadowObserver;
var EvidenceCollector = require('./evidence-collector').EvidenceCollector;

function createRuntimeObserver(config) {
  config = config || {};
  if (typeof config.locateV2 !== 'function') {
    throw new TypeError('chordV2Shadow.locateV2 is required');
  }

  var collector = config.collector || new EvidenceCollector();
  var emit = typeof config.emit === 'function'
    ? function(record) {
        collector.emit(record);
        return config.emit(record);
      }
    : collector.emit.bind(collector);

  var observer = new ShadowObserver({
    locateV2: config.locateV2,
    emit: emit
  });

  var observe = function(event) {
    return observer.observe({
      operation: event.operation,
      key: event.key,
      legacyOwnerId: event.legacyOwnerId,
      startId: event.startId,
      metadata: {
        source: event.source || 'legacy-runtime',
        observedAt: event.observedAt || null
      }
    });
  };

  observe.collector = collector;
  observe.observer = observer;
  return observe;
}

function resolveRuntimeObserver(node) {
  if (!node || !node.server || !node.server._options) return null;
  var options = node.server._options;

  if (typeof options.onChordV2ShadowObservation === 'function') {
    return options.onChordV2ShadowObservation;
  }

  if (!options.chordV2Shadow || typeof options.chordV2Shadow !== 'object') {
    return null;
  }

  if (options.__chordV2ShadowObserverResolved) {
    return options.__chordV2ShadowObserver || null;
  }

  options.__chordV2ShadowObserverResolved = true;
  try {
    options.__chordV2ShadowObserver = createRuntimeObserver(options.chordV2Shadow);
  } catch (error) {
    options.__chordV2ShadowObserver = null;
  }
  return options.__chordV2ShadowObserver;
}

module.exports = {
  createRuntimeObserver: createRuntimeObserver,
  resolveRuntimeObserver: resolveRuntimeObserver
};
