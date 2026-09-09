# Flowchain Ledger → Chord v2 migration baseline

This document freezes the first ledger-side migration boundary. The existing `p2p/` tree remains the production/legacy compatibility path during shadow validation.

## Baseline

- Upstream historical baseline: `flowchain/flowchain-ledger` `master` at `34d155e6b42c7baf1c81105b4b92145fe64cccab`.
- Ledger package: `flowchain.js` v0.5.0.
- Embedded `p2p/` package: historical `node-p2p-chord` v0.5.2+ fork.
- Canonical replacement Chord implementation: `jollen/node-p2p-chord:chord-v2` (later PR target: `flowchain/node-p2p-chord`).

## Frozen legacy behavior

The existing runtime currently owns both generic Chord topology and Flowchain application behavior. Examples include:

- `Node.save(data)` deriving a key inside the Chord node and issuing `FIND_SUCCESSOR`;
- `Node.read(key)` issuing a data-bearing `FIND_SUCCESSOR`;
- `submitVirtualBlocks()` and `NOTIFY_EDGE` living on the embedded Chord node;
- server handlers directly importing `p2p/libs/message` and `p2p/libs/utils`.

These paths are not modified in the first shadow pipeline. They remain the serving path and the compatibility oracle for observable behavior.

## Migration rule

The first ledger-side integration is **shadow-only**:

```text
legacy p2p owner/key path ───────────────→ continues serving
                 │
                 └─ observation ─→ Chord v2 placement lookup
                                      │
                                      └─ evidence: match / mismatch / error
```

Shadow code MUST NOT:

1. change the owner selected by legacy code;
2. send application data to the Chord v2 result;
3. mutate legacy successor/predecessor/finger state;
4. replace `save`, `read`, `NOTIFY_EDGE`, or Virtual Block semantics;
5. silently select a 160-bit/256-bit key projection policy.

## Key ownership boundary

Flowchain Ledger owns data-key derivation. Chord owns only identifier-space normalization and `successor(key)` placement.

The original paper describes double SHA-256 for data-key derivation, while the historical implementation currently uses a non-deterministic SHA-1 helper that mixes time and randomness. The shadow layer therefore does **not** recompute a legacy key. It observes the actual key produced by the serving legacy path and may compare that exact identifier against Chord v2.

A future deterministic Ledger key policy must be explicit and versioned. If Ledger uses 256-bit data keys with a 160-bit ring, the projection must also be explicit and versioned; this pipeline intentionally does not choose one.

## Runtime compatibility

The root package still declares Node 8.14. Chord v2 uses modern exact-integer semantics, so shadow tooling is isolated under `migration/chord-v2-shadow/` with its own modern runtime contract. This avoids changing the production package engine or loading BigInt-based code into the historical runtime before cutover.
