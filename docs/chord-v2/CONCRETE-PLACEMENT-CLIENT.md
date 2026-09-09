# Concrete Chord v2 placement client

Pipeline 8D connects the Flowchain Ledger shadow bridge to the real Chord v2 placement contract without adding a hard dependency to the historical root package.

## Dependency boundary

`migration/chord-v2-shadow/placement-client.js` loads the Chord v2 module explicitly from an injected filesystem path or accepts an already loaded module for tests.

The required module contract is:

```js
createPlacementAdapter({ space, getNode, isLive, maxHops })
```

This matches the `node-p2p-chord` v2 integration boundary. The ledger adapter does not copy `findSuccessor()` or ring arithmetic.

## Topology provider

The placement client also requires a `topologyProvider()` that supplies a read-only v2 topology view:

- `space`
- `getNode(id)`
- `isLive(id)`
- optional `maxHops`
- optional fallback `startId`

This separation is deliberate. Production topology discovery and transport are deployment concerns; placement correctness remains owned by Chord v2.

## Shadow-only rule

The concrete client exposes only `locate()`. It does not expose `save`, `read`, or `send` and cannot become an application data path by accident.

Errors from module loading, topology discovery, or placement are expected to propagate to `ShadowObserver`, where they become `status: error` evidence. They do not alter the legacy owner or serving path.

## Deployment shape

A modern shadow process can configure:

```js
const { createPlacementClient } = require('./migration/chord-v2-shadow')

const placement = createPlacementClient({
  modulePath: process.env.CHORD_V2_MODULE_PATH,
  topologyProvider
})

server.start({
  chordV2Shadow: {
    locateV2: input => placement.locate(input)
  }
})
```

`CHORD_V2_MODULE_PATH` should point to the checked-out or packaged `node-p2p-chord/v2` module under the modern runtime. No dependency is added to root `flowchain.js` yet.
