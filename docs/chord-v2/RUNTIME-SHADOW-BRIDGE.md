# Chord v2 runtime shadow bridge

Pipeline 8C connects the non-blocking legacy observation hook to the ledger-side `ShadowObserver` without making Chord v2 authoritative.

## Runtime configuration

A server may provide a shadow locator through `_options.chordV2Shadow`:

```js
{
  chordV2Shadow: {
    locateV2: async ({ key, startId }) => {
      // delegate to the Chord v2 placement client / adapter
      return { ownerId, hops, path }
    }
  }
}
```

The runtime bridge lazily creates exactly one observer for that server instance. The legacy hook emits an observation after `FOUND_SUCCESSOR` has already selected the legacy owner. The observer then invokes `locateV2()` and records one of:

- `match`
- `mismatch`
- `error`

The bridge does not send data, mutate topology, or replace the legacy owner.

## Precedence and compatibility

An explicitly supplied `_options.onChordV2ShadowObservation` callback still has precedence. This preserves the Pipeline 8B extension point and allows tests or deployments to provide their own observer.

If `chordV2Shadow` is missing or invalid, observer resolution returns `null`. The runtime hook remains fail-open and the original legacy dispatch continues normally.

## Evidence

The default bridge owns an in-memory `EvidenceCollector`. Callers can pass a collector or an `emit(record)` callback in `chordV2Shadow` to persist or export evidence.

The evidence is still non-authoritative. A mismatch means only that the legacy serving result and Chord v2 prediction differ for the observed key. It is not a cutover decision.

## Chord v2 client boundary

This repository intentionally does not vendor another copy of the Chord v2 routing algorithm. `locateV2()` is the integration seam to `node-p2p-chord` v2's placement adapter/client. This prevents the Ledger repository from growing a second ownership implementation.

The next migration gate should provide a concrete deployment adapter for that seam and begin collecting field evidence before any routing cutover.
