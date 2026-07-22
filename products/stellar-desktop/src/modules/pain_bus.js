/**
 * Pain Bus — 疼痛信号模块 (P0)
 * 
 * 桌面端内置疼痛信号机制，定义 4 级疼痛。
 * 信号存储：本地 %APPDATA%/.anima/pain_signals/
 */

const fs = require('fs');
const path = require('path');

// 疼痛等级
const PAIN_LEVELS = {
  P0: { label: '紧急', priority: 0, color: '#ef4444' },
  P1: { label: '重要', priority: 1, color: '#f59e0b' },
  P2: { label: '提醒', priority: 2, color: '#3b82f6' },
  P3: { label: '记录', priority: 3, color: '#6b7280' }
};

class PainBus {
  constructor(animaDir) {
    this.signalsDir = path.join(animaDir, 'pain_signals');
    this._ensureDir();
  }

  _ensureDir() {
    if (!fs.existsSync(this.signalsDir)) {
      fs.mkdirSync(this.signalsDir, { recursive: true });
    }
  }

  _signalPath(id) {
    return path.join(this.signalsDir, `${id}.json`);
  }

  /**
   * 触发疼痛信号
   * @param {string} level - P0/P1/P2/P3
   * @param {string} source - 触发源（如 nas_unreachable, llm_timeout）
   * @param {string} message - 描述
   * @param {object} meta - 附加数据
   * @returns {object} 信号对象
   */
  emit(level, source, message, meta = {}) {
    const id = `pain_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const signal = {
      id,
      level,
      source,
      message,
      meta,
      status: 'open',
      createdAt: new Date().toISOString(),
      resolvedAt: null
    };

    this._ensureDir();
    fs.writeFileSync(this._signalPath(id), JSON.stringify(signal, null, 2), 'utf-8');
    
    // 也存一份按来源索引的列表
    this._appendToSourceIndex(source, id);

    console.log(`[PainBus] ${level} 来自 ${source}: ${message}`);
    return signal;
  }

  _appendToSourceIndex(source, signalId) {
    const idxFile = path.join(this.signalsDir, '_by_source.json');
    let idx = {};
    try {
      if (fs.existsSync(idxFile)) {
        idx = JSON.parse(fs.readFileSync(idxFile, 'utf-8'));
      }
    } catch (_) { idx = {}; }
    if (!idx[source]) idx[source] = [];
    idx[source].push({ signalId, timestamp: new Date().toISOString() });
    fs.writeFileSync(idxFile, JSON.stringify(idx, null, 2), 'utf-8');
  }

  /**
   * 解决疼痛信号
   * @param {string} id - 信号 ID
   */
  resolve(id) {
    const sigPath = this._signalPath(id);
    if (!fs.existsSync(sigPath)) return { success: false, error: '信号不存在' };
    try {
      const signal = JSON.parse(fs.readFileSync(sigPath, 'utf-8'));
      signal.status = 'resolved';
      signal.resolvedAt = new Date().toISOString();
      fs.writeFileSync(sigPath, JSON.stringify(signal, null, 2), 'utf-8');
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * 获取所有未解决的疼痛信号
   * @param {string} level - 可选，按等级过滤
   * @returns {Array}
   */
  listOpen(level) {
    this._ensureDir();
    const signals = [];
    try {
      const files = fs.readdirSync(this.signalsDir).filter(f => f.startsWith('pain_') && f.endsWith('.json'));
      for (const f of files) {
        try {
          const signal = JSON.parse(fs.readFileSync(path.join(this.signalsDir, f), 'utf-8'));
          if (signal.status === 'open' && (!level || signal.level === level)) {
            signals.push(signal);
          }
        } catch (_) {}
      }
    } catch (_) {}
    // 按优先级排序
    return signals.sort((a, b) => {
      const pa = PAIN_LEVELS[a.level]?.priority ?? 99;
      const pb = PAIN_LEVELS[b.level]?.priority ?? 99;
      return pa - pb;
    });
  }

  /**
   * 获取所有信号（含已解决）
   */
  listAll() {
    this._ensureDir();
    const signals = [];
    try {
      const files = fs.readdirSync(this.signalsDir).filter(f => f.startsWith('pain_') && f.endsWith('.json'));
      for (const f of files) {
        try {
          signals.push(JSON.parse(fs.readFileSync(path.join(this.signalsDir, f), 'utf-8')));
        } catch (_) {}
      }
    } catch (_) {}
    return signals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const all = this.listAll();
    return {
      total: all.length,
      open: all.filter(s => s.status === 'open').length,
      byLevel: {
        P0: all.filter(s => s.level === 'P0' && s.status === 'open').length,
        P1: all.filter(s => s.level === 'P1' && s.status === 'open').length,
        P2: all.filter(s => s.level === 'P2' && s.status === 'open').length,
        P3: all.filter(s => s.level === 'P3' && s.status === 'open').length
      }
    };
  }
}

module.exports = { PainBus, PAIN_LEVELS };
