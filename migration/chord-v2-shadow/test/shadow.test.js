'use strict'

const assert = require('assert')
const { ShadowObserver, EvidenceCollector } = require('..')

async function run() {
  const collector = new EvidenceCollector()
  const observer = new ShadowObserver({
    emit: record => collector.emit(record),
    locateV2: async ({ key }) => {
      if (key === 'dead') throw new Error('synthetic lookup failure')
      if (key === 'bbbb') return { ownerId: 'c0de', hops: 2, path: ['aaaa', 'c0de'] }
      return { ownerId: 'beef', hops: 1, path: ['aaaa', 'beef'] }
    }
  })

  const match = await observer.observe({ operation: 'save', key: 'aaaa', legacyOwnerId: 'beef', startId: 'aaaa' })
  const mismatch = await observer.observe({ operation: 'read', key: 'bbbb', legacyOwnerId: 'beef', startId: 'aaaa' })
  const failure = await observer.observe({ operation: 'save', key: 'dead', legacyOwnerId: 'beef', startId: 'aaaa' })

  assert.strictEqual(match.status, 'match')
  assert.strictEqual(match.v2OwnerId, 'beef')
  assert.strictEqual(mismatch.status, 'mismatch')
  assert.strictEqual(mismatch.v2OwnerId, 'c0de')
  assert.strictEqual(failure.status, 'error')

  const summary = collector.summary()
  assert.deepStrictEqual(summary, { total: 3, match: 1, mismatch: 1, error: 1, matchRate: 1 / 3 })
  assert.strictEqual(collector.mismatches().length, 1)
  assert.strictEqual(collector.errors().length, 1)

  // Shadow evidence is observational only: no send/save/read/mutation API is exposed.
  assert.strictEqual(typeof observer.send, 'undefined')
  assert.strictEqual(typeof observer.save, 'undefined')
  assert.strictEqual(typeof observer.read, 'undefined')

  console.log(JSON.stringify({ shadowObserver: 'PASS', matchMismatchError: 'PASS', nonAuthoritativeGate: 'PASS' }, null, 2))
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
