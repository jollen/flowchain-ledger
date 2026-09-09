'use strict'

const assert = require('assert')
const Chord = require('../../../p2p/libs/message')
const { installRuntimeHook } = require('../runtime-hook')

function createNodeClass() {
  function Node() {
    this.id = '0001'
    this.server = { _options: {} }
    this.dispatched = []
  }
  Node.prototype.dispatch = function(from, message) {
    this.dispatched.push({ from, message })
    return 'legacy-result'
  }
  return Node
}

async function nextTurn() {
  await new Promise(resolve => setTimeout(resolve, 0))
}

async function testObservationDoesNotChangeLegacyResult() {
  const Node = createNodeClass()
  installRuntimeHook(Node)
  const node = new Node()
  let observed = null
  node.server._options.onChordV2ShadowObservation = event => { observed = event }

  const from = { id: '00aa' }
  const message = { type: Chord.FOUND_SUCCESSOR, id: '00ff', data: { hello: 'world' } }
  const result = node.dispatch(from, message)

  assert.strictEqual(result, 'legacy-result')
  assert.strictEqual(node.dispatched.length, 1)
  assert.strictEqual(observed.key, '00ff')
  assert.strictEqual(observed.legacyOwnerId, '00aa')
  assert.strictEqual(observed.operation, 'save')
}

async function testReadClassification() {
  const Node = createNodeClass()
  installRuntimeHook(Node)
  const node = new Node()
  let observed = null
  node.server._options.onChordV2ShadowObservation = event => { observed = event }

  node.dispatch({ id: '00bb' }, {
    type: Chord.FOUND_SUCCESSOR,
    id: '00cc',
    data: { origin: { id: '0001' }, key: '00cc' }
  })

  assert.strictEqual(observed.operation, 'read')
}

async function testSyncObserverFailureIsSwallowed() {
  const Node = createNodeClass()
  installRuntimeHook(Node)
  const node = new Node()
  node.server._options.onChordV2ShadowObservation = () => { throw new Error('shadow failed') }

  const result = node.dispatch({ id: '00aa' }, { type: Chord.FOUND_SUCCESSOR, id: '00ff', data: {} })
  assert.strictEqual(result, 'legacy-result')
  assert.strictEqual(node.dispatched.length, 1)
}

async function testAsyncObserverFailureIsSwallowed() {
  const Node = createNodeClass()
  installRuntimeHook(Node)
  const node = new Node()
  node.server._options.onChordV2ShadowObservation = async () => { throw new Error('async shadow failed') }

  const result = node.dispatch({ id: '00aa' }, { type: Chord.FOUND_SUCCESSOR, id: '00ff', data: {} })
  assert.strictEqual(result, 'legacy-result')
  await nextTurn()
  assert.strictEqual(node.dispatched.length, 1)
}

async function testUnrelatedMessagesAreNotObserved() {
  const Node = createNodeClass()
  installRuntimeHook(Node)
  const node = new Node()
  let count = 0
  node.server._options.onChordV2ShadowObservation = () => { count += 1 }

  node.dispatch({ id: '00aa' }, { type: Chord.MESSAGE, id: '00ff', data: {} })
  assert.strictEqual(count, 0)
}

;(async () => {
  await testObservationDoesNotChangeLegacyResult()
  await testReadClassification()
  await testSyncObserverFailureIsSwallowed()
  await testAsyncObserverFailureIsSwallowed()
  await testUnrelatedMessagesAreNotObserved()
  console.log(JSON.stringify({
    legacyResultPreserved: 'PASS',
    saveReadClassification: 'PASS',
    syncShadowFailureIsolation: 'PASS',
    asyncShadowFailureIsolation: 'PASS',
    unrelatedMessageIsolation: 'PASS'
  }, null, 2))
})().catch(error => {
  console.error(error)
  process.exitCode = 1
})
