/**
 * Thermo — 资源水位监控模块 (P1)
 * 
 * 监控 CPU/内存/磁盘使用率，阈值告警。
 * 阈值：CPU > 80%（P2）、内存 > 80%（P2）、磁盘 < 10%（P1）
 */

const os = require('os');
const fs = require('fs');
const path = require('path');

class Thermo {
  constructor(animaDir, painBus) {
    this.animaDir = animaDir;
    this.painBus = painBus;
    this._timer = null;
    this._history = [];
    this.MAX_HISTORY = 60; // 保存最近 60 个采样点（5 分钟 * 60 = 5 小时）
  }

  /**
   * 启动监控（每 5 秒采样一次）
   */
  start() {
    this._sample(); // 立即采样
    this._timer = setInterval(() => this._sample(), 5000);
    console.log('[Thermo] 资源监控已启动');
    return { success: true };
  }

  /**
   * 停止监控
   */
  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  /**
   * 采样一次
   */
  _sample() {
    const sample = {
      timestamp: new Date().toISOString(),
      cpu: this._getCPUUsage(),
      memory: this._getMemoryUsage(),
      disk: this._getDiskUsage()
    };

    // 检测阈值
    this._checkThresholds(sample);

    // 保存历史
    this._history.push(sample);
    if (this._history.length > this.MAX_HISTORY) {
      this._history.shift();
    }

    return sample;
  }

  /**
   * 获取 CPU 使用率（近似值，基于 1 秒间隔）
   */
  _getCPUUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    }
    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    return parseFloat(((1 - idle / total) * 100).toFixed(1));
  }

  /**
   * 获取内存使用率
   */
  _getMemoryUsage() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    return {
      total: this._formatBytes(total),
      free: this._formatBytes(free),
      used: this._formatBytes(used),
      percent: parseFloat(((used / total) * 100).toFixed(1))
    };
  }

  /**
   * 获取磁盘使用率（通过 os 模块获取当前盘）
   */
  _getDiskUsage() {
    // Windows: 检查 C: 盘根目录
    try {
      const root = process.platform === 'win32' ? 'C:\\' : '/';
      const stats = fs.statfsSync(root);
      const free = stats.bfree * stats.bsize;
      const total = stats.blocks * stats.bsize;
      const used = total - free;
      return {
        total: this._formatBytes(total),
        free: this._formatBytes(free),
        used: this._formatBytes(used),
        freePercent: parseFloat(((free / total) * 100).toFixed(1)),
        usedPercent: parseFloat(((used / total) * 100).toFixed(1))
      };
    } catch (e) {
      return { total: 'N/A', free: 'N/A', used: 'N/A', freePercent: 100, usedPercent: 0 };
    }
  }

  /**
   * 阈值检测
   */
  _checkThresholds(sample) {
    if (!this.painBus) return;

    // CPU > 80%
    if (sample.cpu > 80) {
      this.painBus.emit('P2', 'thermo_cpu', `CPU 使用率 ${sample.cpu}% 超阈值 80%`, { value: sample.cpu });
    }

    // 内存 > 80%
    if (sample.memory.percent > 80) {
      this.painBus.emit('P2', 'thermo_memory', `内存使用率 ${sample.memory.percent}% 超阈值 80%`, { value: sample.memory.percent });
    }

    // 磁盘 < 10%
    if (sample.disk.freePercent < 10) {
      this.painBus.emit('P1', 'thermo_disk', `磁盘剩余 ${sample.disk.freePercent}% 低于阈值 10%`, { value: sample.disk.freePercent });
    }
  }

  _formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) {
      size /= 1024;
      i++;
    }
    return `${size.toFixed(1)} ${units[i]}`;
  }

  /**
   * 获取最新采样
   */
  getLatest() {
    return this._history.length > 0 ? this._history[this._history.length - 1] : null;
  }

  /**
   * 获取采样历史
   */
  getHistory() {
    return [...this._history];
  }

  /**
   * 获取系统信息
   */
  getSystemInfo() {
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      uptime: Math.floor(os.uptime()),
      loadAvg: os.loadavg(),
      totalMemory: this._formatBytes(os.totalmem())
    };
  }
}

module.exports = { Thermo };
