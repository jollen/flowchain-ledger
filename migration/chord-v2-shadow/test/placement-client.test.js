'use strict';

const assert = require('assert');
const { ChordV2PlacementClient } = require('../placement-client');

async function main() {
  const calls = [];
  const fakeChord = {
    createPlacementAdapter(options) {
      calls.push(options);
      return {
        locate(input) {
          return { key: input.key, ownerId: '00bb', path: ['00aa', '00bb'], hops: 1 };
        }
      };
    }
  };

  const client = new ChordV2PlacementClient({
    chord: fakeChord,
    topologyProvider: async ({ key, startId }) => ({
      space: { normalize: value => value },
      getNode: () => null,
      isLive: () => true,
      maxHops: 32,
      startId: startId || '00aa',
      observedKey: key
    })
  });

  const result = await client.locate({ key: '00ab', startId: '00aa' });
  assert.deepStrictEqual(result, { key: '00ab', ownerId: '00bb', path: ['00aa', '00bb'], hops: 1 });
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].maxHops, 32);

  let topologyCalls = 0;
  const failClient = new ChordV2PlacementClient({
    chord: fakeChord,
    topologyProvider: async () => {
      topologyCalls += 1;
      throw new Error('topology unavailable');
    }
  });
  await assert.rejects(failClient.locate({ key: '00ab', startId: '00aa' }), /topology unavailable/);
  assert.strictEqual(topologyCalls, 1);

  assert.strictEqual(typeof client.save, 'undefined');
  assert.strictEqual(typeof client.read, 'undefined');
  assert.strictEqual(typeof client.send, 'undefined');

  console.log(JSON.stringify({
    concretePlacementDelegation: 'PASS',
    topologyProviderFailurePropagation: 'PASS',
    noApplicationSideEffects: 'PASS'
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
