'use strict';

const assert = require('assert');
const {
  LegacyTopologySnapshotAdapter,
  snapshotLegacyNode
} = require('../topology-snapshot');

function makeNode(id, successorId, predecessorId, fingerIds) {
  return {
    id,
    address: '127.0.0.1',
    port: 8000,
    successor: successorId ? { id: successorId, address: '127.0.0.1', port: 8000 } : null,
    predecessor: predecessorId ? { id: predecessorId, address: '127.0.0.1', port: 8000 } : null,
    fingers: (fingerIds || []).map((fingerId, index) => ({
      key: (index + 1).toString(16),
      successor: { id: fingerId, address: '127.0.0.1', port: 8000 }
    }))
  };
}

class FakeSpace {
  normalize(value) {
    if (typeof value === 'bigint') return value;
    return BigInt('0x' + String(value).replace(/^0x/i, ''));
  }
}

async function testSnapshotIsDetachedAndFrozen() {
  const legacy = makeNode('10', '20', '40', ['20', '30']);
  const snapshot = snapshotLegacyNode(legacy);

  legacy.successor.id = 'ff';
  legacy.fingers[0].successor.id = 'ee';

  assert.strictEqual(snapshot.successor.id, '20');
  assert.strictEqual(snapshot.fingers[0].successor.id, '20');
  assert(Object.isFrozen(snapshot));
  assert(Object.isFrozen(snapshot.fingers));
}

async function testCompleteSnapshot() {
  const nodes = {
    '10': makeNode('10', '20', '40', ['20', '30']),
    '20': makeNode('20', '30', '10', ['30', '40']),
    '30': makeNode('30', '40', '20', ['40', '10']),
    '40': makeNode('40', '10', '30', ['10', '20'])
  };

  const adapter = new LegacyTopologySnapshotAdapter({
    resolvePeer: async id => nodes[id] || null
  });
  const snapshot = await adapter.capture(nodes['10']);

  assert.strictEqual(snapshot.complete, true);
  assert.strictEqual(snapshot.nodes.size, 4);
  assert.deepStrictEqual(snapshot.unresolved, []);
}

async function testIncompleteSnapshotRejectedByDefault() {
  const root = makeNode('10', '20', null, ['20']);
  const adapter = new LegacyTopologySnapshotAdapter();
  const snapshot = await adapter.capture(root);

  assert.strictEqual(snapshot.complete, false);
  assert.deepStrictEqual(snapshot.unresolved, ['20']);
  assert.throws(() => adapter.toTopology(snapshot, new FakeSpace()), /incomplete/);
}

async function testTopologyViewIsReadOnlyProjection() {
  const nodes = {
    '10': makeNode('10', '20', '20', ['20']),
    '20': makeNode('20', '10', '10', ['10'])
  };
  const adapter = new LegacyTopologySnapshotAdapter({ resolvePeer: async id => nodes[id] || null });
  const snapshot = await adapter.capture(nodes['10']);
  const topology = adapter.toTopology(snapshot, new FakeSpace());

  const ten = topology.getNode(0x10n);
  assert.strictEqual(ten.id, 0x10n);
  assert.strictEqual(ten.successor, 0x20n);
  assert.strictEqual(topology.isLive(0x20n), true);
  assert.strictEqual(topology.isLive(0x30n), false);
  assert(Object.isFrozen(ten));
  assert(Object.isFrozen(ten.fingers));
}

(async () => {
  await testSnapshotIsDetachedAndFrozen();
  await testCompleteSnapshot();
  await testIncompleteSnapshotRejectedByDefault();
  await testTopologyViewIsReadOnlyProjection();
  console.log(JSON.stringify({
    detachedFrozenSnapshot: 'PASS',
    completeSnapshot: 'PASS',
    incompleteSnapshotGate: 'PASS',
    readOnlyTopologyProjection: 'PASS'
  }, null, 2));
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
