'use strict'

function normalizeId(value) {
  if (typeof value === 'bigint') return value.toString(16)
  if (typeof value === 'number') return BigInt(value).toString(16)
  if (typeof value === 'string') return value.replace(/^0x/i, '').toLowerCase()
  throw new TypeError('identifier must be bigint, number, or hex string')
}

class ShadowObserver {
  constructor({ locateV2, emit = () => {} }) {
    if (typeof locateV2 !== 'function') throw new TypeError('locateV2 is required')
    if (typeof emit !== 'function') throw new TypeError('emit must be a function')
    this.locateV2 = locateV2
    this.emit = emit
  }

  async observe({ operation, key, legacyOwnerId, startId, metadata = null }) {
    if (typeof operation !== 'string' || operation.length === 0) throw new TypeError('operation is required')
    if (key === null || typeof key === 'undefined') throw new TypeError('key is required')
    if (legacyOwnerId === null || typeof legacyOwnerId === 'undefined') throw new TypeError('legacyOwnerId is required')

    const base = {
      schemaVersion: 1,
      mode: 'shadow',
      operation,
      key: normalizeId(key),
      legacyOwnerId: normalizeId(legacyOwnerId),
      startId: startId === null || typeof startId === 'undefined' ? null : normalizeId(startId),
      metadata,
      timestamp: new Date().toISOString()
    }

    try {
      const result = await this.locateV2({ key, startId })
      const v2OwnerId = normalizeId(result.ownerId)
      const evidence = {
        ...base,
        status: v2OwnerId === base.legacyOwnerId ? 'match' : 'mismatch',
        v2OwnerId,
        hops: typeof result.hops === 'number' ? result.hops : null,
        path: Array.isArray(result.path) ? result.path.map(normalizeId) : null,
        error: null
      }
      this.emit(evidence)
      return evidence
    } catch (error) {
      const evidence = {
        ...base,
        status: 'error',
        v2OwnerId: null,
        hops: null,
        path: null,
        error: { name: error && error.name ? error.name : 'Error', message: error && error.message ? error.message : String(error) }
      }
      this.emit(evidence)
      return evidence
    }
  }
}

module.exports = { ShadowObserver, normalizeId }
