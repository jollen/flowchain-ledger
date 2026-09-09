'use strict'

class EvidenceCollector {
  constructor() {
    this.records = []
  }

  emit(record) {
    this.records.push(record)
  }

  summary() {
    const summary = { total: this.records.length, match: 0, mismatch: 0, error: 0 }
    for (const record of this.records) {
      if (Object.prototype.hasOwnProperty.call(summary, record.status)) summary[record.status] += 1
    }
    summary.matchRate = summary.total === 0 ? null : summary.match / summary.total
    return summary
  }

  mismatches() {
    return this.records.filter(record => record.status === 'mismatch')
  }

  errors() {
    return this.records.filter(record => record.status === 'error')
  }
}

module.exports = { EvidenceCollector }
