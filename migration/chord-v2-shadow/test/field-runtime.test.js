'use strict';

const assert = require('assert');
const { configureFieldShadow } = require('../field-runtime');

class FakeSpace {
  constructor(bits) { this.bits = bits; }
  fromHex(hex) { return BigInt('0x' + hex); }
  normalize(value) { return typeof value === 'bigint' ? value : BigInt(value); }
}

const fakeChord = {
  IdentifierSpace: FakeSpace,
  createPlacementAdapter(options) {
    return {
      locate({ key, startId }) {
        const node = options.getNode(startId);
        return {
          key,
          ownerId: node.successor,
          path: [startId, node.successor],
          hops: 1
        };
      }
    };
  }
};

function peer(id, successorId) {
  return {
    id,
    address: '127.0.0.1',
    port: 8000,
    predecessor: null,
    successor: { id: successorId, address: '127.0.0.1', port: 8000 },
    fingers: []
  };
}

;(async () => {
  const a = peer('a', 'f');
  const f = peer('f', 'a');
  a.predecessor = { id: 'f', address: '127.0.0.1', port: 8000 };
  f.predecessor = { id: 'a', address: '127.0.0.1', port: 8000 };

  const emitted = [];
  const server = {
    node: a,
    nodes: { a, f },
    _options: {}
  };

  const runtime = configureFieldShadow(server, {
    chord: fakeChord,
    bits: 8,
    emit: record => emitted.push(record)
  });

  assert.strictEqual(runtime.mode, 'shadow');
  assert.strictEqual(runtime.bits, 8);
  assert(server._options.chordV2Shadow);

  const result = await server._options.chordV2Shadow.locateV2({ key: '0b', startId: 'a' });
  assert.strictEqual(result.ownerId, 15n);
  assert.deepStrictEqual(result.path, [10n, 15n]);

  // Local server.nodes is the first field resolver before any external resolver.
  const snapshot = await runtime.snapshotAdapter.capture(server.node);
  assert.strictEqual(snapshot.complete, true);
  assert.strictEqual(snapshot.nodes.size, 2);

  // Field runtime remains placement/evidence only.
  assert.strictEqual(runtime.save, undefined);
  assert.strictEqual(runtime.read, undefined);
  assert.strictEqual(runtime.send, undefined);

  await runtime.close();

  console.log(JSON.stringify({
    localPeerResolution: 'PASS',
    explicitHexConversion: 'PASS',
    concretePlacement: 'PASS',
    noApplicationAuthority: 'PASS'
  }, null, 2));
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
