'use strict'

const assert = require('assert')
const { createRuntimeObserver, resolveRuntimeObserver } = require('../runtime-bridge')

async function testMatchEvidence() {
  const calls = []
  const observer = createRuntimeObserver({
    locateV2: async ({ key, startId }) => {
      calls.push({ key, startId })
      return { ownerId: '0a', hops: 2, path: ['01', '05', '0a'] }
    }
  })

  const evidence = await observer({
    operation: 'save',
    key: '0A',
    legacyOwnerId: '0a',
    startId: '01',
    source: 'legacy-found-successor',
    observedAt: '2026-09-09T00:00:00.000Z'
  })

  assert.strictEqual(evidence.status, 'match')
  assert.strictEqual(evidence.v2OwnerId, '0a')
  assert.strictEqual(evidence.hops, 2)
  assert.deepStrictEqual(calls, [{ key: '0A', startId: '01' }])
  assert.strictEqual(observer.collector.summary().match, 1)
}

async function testMismatchEvidence() {
  const observer = createRuntimeObserver({
    locateV2: async () => ({ ownerId: '0b', hops: 1, path: ['01', '0b'] })
  })
  const evidence = await observer({ operation: 'read', key: '0a', legacyOwnerId: '0a', startId: '01' })
  assert.strictEqual(evidence.status, 'mismatch')
  assert.strictEqual(observer.collector.summary().mismatch, 1)
}

async function testLocatorFailureBecomesEvidence() {
  const observer = createRuntimeObserver({
    locateV2: async () => { throw new Error('shadow unavailable') }
  })
  const evidence = await observer({ operation: 'save', key: '0a', legacyOwnerId: '0a', startId: '01' })
  assert.strictEqual(evidence.status, 'error')
  assert.strictEqual(evidence.error.message, 'shadow unavailable')
  assert.strictEqual(observer.collector.summary().error, 1)
}

function testResolveConfiguredObserverOnce() {
  let locateCalls = 0
  const node = {
    server: {
      _options: {
        chordV2Shadow: {
          locateV2: async () => {
            locateCalls += 1
            return { ownerId: '01', hops: 0, path: ['01'] }
          }
        }
      }
    }
  }

  const first = resolveRuntimeObserver(node)
  const second = resolveRuntimeObserver(node)
  assert.strictEqual(first, second)
  assert.strictEqual(typeof first, 'function')
  assert.strictEqual(locateCalls, 0)
}

function testExplicitObserverWins() {
  const explicit = () => Promise.resolve()
  const node = { server: { _options: { onChordV2ShadowObservation: explicit, chordV2Shadow: { locateV2: async () => ({ ownerId: 'x' }) } } } }
  assert.strictEqual(resolveRuntimeObserver(node), explicit)
}

function testInvalidConfigFailsOpen() {
  const node = { server: { _options: { chordV2Shadow: {} } } }
  assert.strictEqual(resolveRuntimeObserver(node), null)
  assert.strictEqual(resolveRuntimeObserver(node), null)
}

;(async () => {
  await testMatchEvidence()
  await testMismatchEvidence()
  await testLocatorFailureBecomesEvidence()
  testResolveConfiguredObserverOnce()
  testExplicitObserverWins()
  testInvalidConfigFailsOpen()
  console.log(JSON.stringify({
    matchEvidence: 'PASS',
    mismatchEvidence: 'PASS',
    locatorFailureEvidence: 'PASS',
    lazyObserverResolution: 'PASS',
    explicitObserverPrecedence: 'PASS',
    invalidConfigFailOpen: 'PASS'
  }, null, 2))
})().catch(error => {
  console.error(error)
  process.exitCode = 1
})
