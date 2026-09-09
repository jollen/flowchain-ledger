'use strict';

var path = require('path');
var PlacementClient = require('./placement-client').ChordV2PlacementClient;
var SnapshotAdapter = require('./topology-snapshot').LegacyTopologySnapshotAdapter;
var toSpaceId = require('./topology-snapshot').toSpaceId;
var JsonlEvidenceSink = require('./jsonl-evidence-sink').JsonlEvidenceSink;

function resolvePeerFromServer(server, externalResolver) {
  return async function(id, current) {
    if (server && server.nodes && server.nodes[id]) return server.nodes[id];
    if (typeof externalResolver === 'function') return externalResolver(id, current);
    return null;
  };
}

function configureFieldShadow(server, config) {
  config = config || {};
  if (!server || !server.node || !server._options) throw new TypeError('Flowchain server is required');

  var chord = config.chord || null;
  if (!chord) {
    if (typeof config.modulePath !== 'string' || config.modulePath.length === 0) {
      throw new TypeError('modulePath or chord module is required');
    }
    chord = require(path.resolve(config.modulePath));
  }
  if (!chord || typeof chord.IdentifierSpace !== 'function') throw new TypeError('Chord v2 IdentifierSpace is required');

  var bits = Number.isInteger(config.bits) && config.bits > 0 ? config.bits : 160;
  var space = new chord.IdentifierSpace(bits);
  var snapshotAdapter = new SnapshotAdapter({
    resolvePeer: resolvePeerFromServer(server, config.resolvePeer),
    maxNodes: config.maxNodes
  });

  var placementClient = new PlacementClient({
    chord: chord,
    topologyProvider: async function(input) {
      var snapshot = await snapshotAdapter.capture(server.node);
      return snapshotAdapter.toTopology(snapshot, space, { allowPartial: config.allowPartial === true });
    }
  });

  var sink = null;
  if (typeof config.evidenceFile === 'string' && config.evidenceFile.length > 0) {
    sink = new JsonlEvidenceSink({
      filePath: config.evidenceFile,
      onError: config.onEvidenceError
    });
  }

  var externalEmit = typeof config.emit === 'function' ? config.emit : null;
  var emit = function(record) {
    if (sink) sink.emit(record);
    if (externalEmit) return externalEmit(record);
  };

  server._options.chordV2Shadow = {
    locateV2: function(input) {
      return placementClient.locate({
        key: toSpaceId(space, input.key),
        startId: toSpaceId(space, input.startId || server.node.id)
      });
    },
    emit: emit
  };

  var runtime = Object.freeze({
    mode: 'shadow',
    bits: bits,
    space: space,
    snapshotAdapter: snapshotAdapter,
    placementClient: placementClient,
    evidenceSink: sink,
    close: async function() {
      if (sink) await sink.close();
    }
  });

  server._chordV2ShadowRuntime = runtime;
  return runtime;
}

module.exports = {
  configureFieldShadow: configureFieldShadow,
  resolvePeerFromServer: resolvePeerFromServer
};
