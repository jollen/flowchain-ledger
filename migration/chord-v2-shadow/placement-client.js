'use strict';

var path = require('path');

function assertFunction(value, name) {
  if (typeof value !== 'function') throw new TypeError(name + ' is required');
}

function loadChordV2(modulePath) {
  if (typeof modulePath !== 'string' || modulePath.length === 0) {
    throw new TypeError('modulePath is required');
  }
  var resolved = path.resolve(modulePath);
  var chord = require(resolved);
  if (!chord || typeof chord.createPlacementAdapter !== 'function') {
    throw new TypeError('Chord v2 module must export createPlacementAdapter()');
  }
  return chord;
}

class ChordV2PlacementClient {
  constructor(options) {
    options = options || {};
    assertFunction(options.topologyProvider, 'topologyProvider');
    this.topologyProvider = options.topologyProvider;
    this.modulePath = options.modulePath || null;
    this.chord = options.chord || null;
    this.adapterFactory = options.adapterFactory || null;
  }

  _resolveChord() {
    if (this.chord) return this.chord;
    this.chord = loadChordV2(this.modulePath);
    return this.chord;
  }

  async locate(input) {
    input = input || {};
    var topology = await this.topologyProvider({ key: input.key, startId: input.startId });
    if (!topology || typeof topology !== 'object') throw new TypeError('topologyProvider must return an object');

    var chord = this._resolveChord();
    var factory = this.adapterFactory || chord.createPlacementAdapter;
    var adapter = factory({
      space: topology.space,
      getNode: topology.getNode,
      isLive: topology.isLive,
      maxHops: topology.maxHops
    });

    if (!adapter || typeof adapter.locate !== 'function') {
      throw new TypeError('placement adapter must expose locate()');
    }

    return adapter.locate({
      key: input.key,
      startId: input.startId || topology.startId
    });
  }
}

function createPlacementClient(options) {
  return new ChordV2PlacementClient(options);
}

module.exports = {
  ChordV2PlacementClient: ChordV2PlacementClient,
  createPlacementClient: createPlacementClient,
  loadChordV2: loadChordV2
};
