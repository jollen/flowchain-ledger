'use strict';

function normalizeHex(value) {
  if (typeof value === 'bigint') return value.toString(16);
  if (typeof value === 'number') return BigInt(value).toString(16);
  if (typeof value === 'string') return value.replace(/^0x/i, '').toLowerCase();
  throw new TypeError('identifier must be bigint, number, or hex string');
}

function clonePeer(peer) {
  if (!peer || typeof peer.id === 'undefined' || peer.id === null) return null;
  return Object.freeze({
    id: normalizeHex(peer.id),
    address: typeof peer.address === 'undefined' ? null : peer.address,
    port: typeof peer.port === 'undefined' ? null : peer.port
  });
}

function snapshotFinger(entry) {
  if (!entry || !entry.successor) return null;
  return Object.freeze({
    key: typeof entry.key === 'undefined' || entry.key === null ? null : normalizeHex(entry.key),
    successor: clonePeer(entry.successor)
  });
}

function snapshotLegacyNode(node) {
  if (!node || typeof node.id === 'undefined' || node.id === null) {
    throw new TypeError('legacy node is required');
  }

  var fingers = Array.isArray(node.fingers)
    ? node.fingers.map(snapshotFinger).filter(Boolean)
    : [];

  return Object.freeze({
    id: normalizeHex(node.id),
    address: typeof node.address === 'undefined' ? null : node.address,
    port: typeof node.port === 'undefined' ? null : node.port,
    successor: clonePeer(node.successor),
    predecessor: clonePeer(node.predecessor),
    fingers: Object.freeze(fingers)
  });
}

function referencedIds(snapshot) {
  var ids = new Set();
  if (snapshot.successor) ids.add(snapshot.successor.id);
  if (snapshot.predecessor) ids.add(snapshot.predecessor.id);
  for (var i = 0; i < snapshot.fingers.length; i += 1) {
    if (snapshot.fingers[i].successor) ids.add(snapshot.fingers[i].successor.id);
  }
  ids.delete(snapshot.id);
  return ids;
}

class LegacyTopologySnapshotAdapter {
  constructor(options) {
    options = options || {};
    this.resolvePeer = typeof options.resolvePeer === 'function' ? options.resolvePeer : null;
    this.maxNodes = Number.isInteger(options.maxNodes) && options.maxNodes > 0 ? options.maxNodes : 4096;
  }

  async capture(rootNode) {
    var nodes = new Map();
    var queue = [snapshotLegacyNode(rootNode)];
    var unresolved = new Set();

    while (queue.length > 0) {
      var current = queue.shift();
      if (nodes.has(current.id)) continue;
      if (nodes.size >= this.maxNodes) throw new Error('topology snapshot exceeded maxNodes');
      nodes.set(current.id, current);

      var refs = referencedIds(current);
      for (var id of refs) {
        if (nodes.has(id)) continue;
        if (!this.resolvePeer) {
          unresolved.add(id);
          continue;
        }

        var resolved = await this.resolvePeer(id, current);
        if (!resolved) {
          unresolved.add(id);
          continue;
        }
        queue.push(snapshotLegacyNode(resolved));
        unresolved.delete(id);
      }
    }

    return Object.freeze({
      capturedAt: new Date().toISOString(),
      rootId: normalizeHex(rootNode.id),
      complete: unresolved.size === 0,
      unresolved: Object.freeze(Array.from(unresolved).sort()),
      nodes: nodes
    });
  }

  toTopology(snapshot, space, options) {
    options = options || {};
    if (!snapshot || !(snapshot.nodes instanceof Map)) throw new TypeError('snapshot is required');
    if (!space || typeof space.normalize !== 'function') throw new TypeError('identifier space is required');
    if (!snapshot.complete && options.allowPartial !== true) {
      throw new Error('legacy topology snapshot is incomplete: ' + snapshot.unresolved.join(','));
    }

    var state = new Map();
    for (var pair of snapshot.nodes.entries()) {
      var legacy = pair[1];
      var id = space.normalize(legacy.id);
      var successor = legacy.successor ? space.normalize(legacy.successor.id) : id;
      var fingers = legacy.fingers.map(function(entry) {
        return { successor: space.normalize(entry.successor.id) };
      });
      state.set(id.toString(), Object.freeze({ id: id, successor: successor, fingers: Object.freeze(fingers) }));
    }

    return Object.freeze({
      startId: space.normalize(snapshot.rootId),
      space: space,
      getNode: function(id) { return state.get(space.normalize(id).toString()) || null; },
      isLive: function(id) { return state.has(space.normalize(id).toString()); },
      maxHops: Math.max(16, state.size * 4),
      snapshot: snapshot
    });
  }
}

module.exports = {
  LegacyTopologySnapshotAdapter: LegacyTopologySnapshotAdapter,
  snapshotLegacyNode: snapshotLegacyNode,
  normalizeHex: normalizeHex
};
