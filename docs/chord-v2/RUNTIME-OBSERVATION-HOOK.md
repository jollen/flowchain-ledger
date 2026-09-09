# Chord v2 shadow runtime observation hook

Pipeline 8B adds the first production-adjacent integration point while preserving legacy authority.

## Hook point

The hook wraps `Node.prototype.dispatch` and observes only data-bearing `FOUND_SUCCESSOR` messages. At this point the historical implementation has already selected the legacy owner and is about to continue its original `FOUND_SUCCESSOR → MESSAGE` behavior.

The emitted event contains:

- `operation`: `save` or `read` inferred from the existing legacy payload shape;
- `key`: the exact key produced by the serving legacy path;
- `legacyOwnerId`: the `from.id` carried by the legacy `FOUND_SUCCESSOR` response;
- `startId`: the local legacy node ID;
- observation timestamp.

## Safety properties

The runtime hook is intentionally fail-open for legacy traffic:

1. if the shadow hook cannot be loaded, `p2p/index.js` still exports the historical Node class;
2. if no observer callback is configured, dispatch proceeds unchanged;
3. synchronous observer exceptions are swallowed;
4. rejected observer promises are swallowed;
5. the original dispatch return value is preserved;
6. unrelated Chord messages are not observed;
7. the hook does not mutate the Chord message, owner, topology, or payload.

The observer callback name is `server._options.onChordV2ShadowObservation`.

## Authority

This hook does not make Chord v2 authoritative. The serving path remains:

```text
legacy FIND_SUCCESSOR
  → legacy FOUND_SUCCESSOR
  → shadow observation (best effort)
  → original legacy dispatch
  → original MESSAGE/save/read behavior
```

A shadow failure must never become a production failure.

## Next integration

A later pipeline may connect `onChordV2ShadowObservation` to the isolated `ShadowObserver` and a real Chord v2 placement client. That connection must remain asynchronous/best-effort until mismatch evidence is understood and an explicit cutover gate is approved.
