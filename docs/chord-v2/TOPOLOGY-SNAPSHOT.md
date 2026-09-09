# Chord v2 read-only legacy topology snapshot

Pipeline 8E adds a read-only adapter that projects the historical embedded Chord runtime into a topology view suitable for shadow placement checks.

## Goal

The adapter exists to compare:

```text
legacy actual owner
vs
Chord v2 predicted owner over the same observed topology
```

It does not mutate the historical runtime.

## Snapshot source

The legacy node exposes these topology references:

- `node.id`
- `node.successor`
- `node.predecessor`
- `node.fingers[*].successor`

The adapter copies those values into detached frozen records. Later mutations of the live legacy node therefore do not change an already captured snapshot.

## Completeness

A single legacy node only contains references to peers; it does not necessarily contain the complete remote node state required by a local Chord v2 lookup.

`LegacyTopologySnapshotAdapter` accepts an optional read-only `resolvePeer(id, currentSnapshot)` function. It follows successor, predecessor, and finger references until the reachable snapshot closes or `maxNodes` is reached.

If a referenced peer cannot be resolved, the snapshot is marked:

```text
complete: false
unresolved: [...]
```

`toTopology()` rejects incomplete snapshots by default. This is intentional: a shadow mismatch derived from missing topology would be misleading. `allowPartial: true` exists only for explicit diagnostic use.

## Chord v2 projection

`toTopology(snapshot, space)` returns the interface expected by the concrete placement client:

- `space`
- `startId`
- `getNode(id)`
- `isLive(id)`
- `maxHops`

Each projected node contains only:

- `id`
- `successor`
- `fingers`

There is no `save`, `read`, `send`, stabilization, TTL, database, or Virtual Block behavior in this view.

## Safety rule

The ownership serving path remains historical Chord. Snapshot capture and Chord v2 interpretation are observation-only and may fail without affecting legacy routing.

The next pipeline can wire this adapter into the concrete placement client with a deployment-specific `resolvePeer()` source. Only after complete snapshots are available should field match/mismatch evidence be treated as topology-comparable.
