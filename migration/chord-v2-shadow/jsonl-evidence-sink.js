'use strict';

var fs = require('fs');
var path = require('path');

class JsonlEvidenceSink {
  constructor(options) {
    options = options || {};
    if (typeof options.filePath !== 'string' || options.filePath.length === 0) {
      throw new TypeError('filePath is required');
    }
    this.filePath = path.resolve(options.filePath);
    this.queue = [];
    this.flushing = false;
    this.closed = false;
    this.lastError = null;
    this.onError = typeof options.onError === 'function' ? options.onError : function() {};
  }

  emit(record) {
    if (this.closed) return false;
    this.queue.push(JSON.stringify(record) + '\n');
    this._schedule();
    return true;
  }

  _schedule() {
    if (this.flushing || this.queue.length === 0 || this.closed) return;
    this.flushing = true;
    setImmediate(this._flush.bind(this));
  }

  async _flush() {
    var batch = this.queue.splice(0, this.queue.length).join('');
    try {
      await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
      await fs.promises.appendFile(this.filePath, batch, 'utf8');
    } catch (error) {
      this.lastError = error;
      try { this.onError(error); } catch (ignored) {}
    } finally {
      this.flushing = false;
      if (this.queue.length > 0 && !this.closed) this._schedule();
    }
  }

  async close() {
    this.closed = true;
    while (this.flushing) {
      await new Promise(function(resolve) { setTimeout(resolve, 1); });
    }
    if (this.queue.length > 0) {
      this.flushing = true;
      this.closed = false;
      await this._flush();
      this.closed = true;
    }
  }
}

module.exports = { JsonlEvidenceSink: JsonlEvidenceSink };
