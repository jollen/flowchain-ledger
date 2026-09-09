# Pipeline 8F — Field Shadow Wiring

This pipeline makes the Chord v2 comparison path field-ready while keeping the historical embedded Chord implementation authoritative.

## Runtime wiring

The shadow runtime is installed explicitly on a Flowchain server instance:

```js
const shadow = require('../../migration/chord-v2-shadow')

const server = require('../../server')

shadow.configureFieldShadow(server, {
  modulePath: process.env.CHORD_V2_MODULE_PATH,
  bits: 160,
  evidenceFile: process.env.CHORD_V2_EVIDENCE_FILE,
  resolvePeer: async (id) => {
    // Optional deployment-specific read-only peer resolver.
    // Return a legacy node-shaped snapshot source or null.
  }
})

server.start({ ... })
```

The root `flowchain.js` dependency graph is not changed. The Chord v2 module is loaded only when field shadowing is explicitly configured.

## Resolution order

A topology reference is resolved in this order:

1. `server.nodes[id]` — local runtime registry;
2. optional deployment `resolvePeer(id, currentSnapshot)`;
3. unresolved.

Incomplete snapshots are rejected by default. `allowPartial: true` is diagnostic-only and must not be used as cutover evidence.

## Exact identifier conversion

Historical Flowchain identifiers are hexadecimal strings without a `0x` prefix. Chord v2's generic `IdentifierSpace.normalize()` accepts BigInt-compatible strings, where a bare string is not unambiguously hexadecimal.

The ledger adapter therefore converts legacy identifiers explicitly through `IdentifierSpace.fromHex()` (or an explicit `0x` fallback) before passing them to Chord v2. This includes:

- root/start node IDs;
- successor IDs;
- finger successors;
- the observed legacy lookup key.

The conversion belongs to the Ledger compatibility adapter because the legacy representation is a Ledger-side compatibility concern.

## Evidence

If `evidenceFile` is configured, each shadow comparison is appended as JSONL using a best-effort asynchronous sink. Evidence write failure is recorded by the sink but does not affect the serving lookup path.

A deployment may also provide `emit(record)` to stream the same evidence elsewhere.

## Safety properties

Field shadowing remains observation-only:

- legacy `save/read/MESSAGE` remains authoritative;
- Chord v2 never sends application data;
- topology snapshots are detached from live node objects;
- Chord v2 cannot mutate legacy predecessor/successor/fingers;
- incomplete topology is a shadow error, not a production error;
- evidence sink failure is non-authoritative;
- no root package dependency or Node engine is changed.

The resulting field path is:

```text
legacy FOUND_SUCCESSOR
        ↓
runtime hook
        ↓
ShadowObserver
        ↓
field runtime
        ↓
read-only topology snapshot
        ↓
ChordV2PlacementClient
        ↓
node-p2p-chord v2 PlacementAdapter
        ↓
match / mismatch / error
        ↓
JSONL / callback evidence
```
