/**
 * SOMA 集成模块 — 自律神经系统
 * 
 * 集成 PainBus、HeartDaemon、Thermo、Digest 到 main.js。
 * 由 main.js 在启动时调用。
 */

const path = require('path');
const fs = require('fs');
const { PainBus } = require('./pain_bus');
const { HeartDaemon } = require('./heartd');
const { Thermo } = require('./thermo');

let painBus = null;
let heartD = null;
let thermo = null;

/**
 * 初始化 SOMA 所有子系统
 * @param {string} animaDir - %APPDATA%/stellar-nyx-desktop/.anima/
 * @param {function} animlinkClient - AnimaLink 客户端引用（用于心跳注册）
 */
function initSOMA(animaDir, animlinkClient) {
  // 初始化 PainBus
  painBus = new PainBus(animaDir);

  // 初始化 HeartDaemon
  heartD = new HeartDaemon(animaDir);
  heartD.setAnimlinkClient(animlinkClient);
  heartD.onStale((status) => {
    painBus.emit('P2', 'heartbeat_stale', '心跳失联超 15 分钟', status);
  });
  heartD.start();

  // 初始化 Thermo
  thermo = new Thermo(animaDir, painBus);
  thermo.start();

  // 自动触发器
  setupAutoTriggers(animaDir);

  return { success: true };
}

/**
 * 设置自动触发的疼痛信号和 Digest 清理
 */
function setupAutoTriggers(animaDir) {
  // 每 30 秒检查磁盘空间
  setInterval(() => {
    try {
      const root = process.platform === 'win32' ? 'C:\\' : '/';
      const stats = fs.statfsSync(root);
      const freePercent = (stats.bfree * stats.bsize) / (stats.blocks * stats.bsize) * 100;
      if (freePercent < 10) {
        painBus.emit('P1', 'disk_space', `磁盘剩余 ${freePercent.toFixed(1)}% 严重不足`, { freePercent });
      }
    } catch (_) {}
  }, 30000);

  // 每 5 分钟运行 Digest 清理
  setInterval(() => {
    try {
      const now = Date.now();
      const logFiles = [];
      const readDir = (dir) => {
        if (!fs.existsSync(dir)) return;
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const fp = path.join(dir, item);
          try {
            const stat = fs.statSync(fp);
            if (stat.isFile()) logFiles.push({ path: fp, mtime: stat.mtimeMs });
          } catch (_) {}
        }
      };

      // 清理 debug log
      if (fs.existsSync(animaDir)) {
        const logs = fs.readdirSync(animaDir).filter(f => f.endsWith('.log'));
        for (const f of logs) {
          const fp = path.join(animaDir, f);
          try {
            const stat = fs.statSync(fp);
            if (now - stat.mtimeMs > 30 * 24 * 60 * 60 * 1000) {
              fs.unlinkSync(fp);
            }
          } catch (_) {}
        }
      }

      // 清理超过 7 天的对话文件
      const convDir = path.join(animaDir, 'conversations');
      if (fs.existsSync(convDir)) {
        const convs = fs.readdirSync(convDir).filter(f => f.endsWith('.json'));
        for (const f of convs) {
          const fp = path.join(convDir, f);
          try {
            const stat = fs.statSync(fp);
            if (now - stat.mtimeMs > 7 * 24 * 60 * 60 * 1000) {
              fs.unlinkSync(fp);
            }
          } catch (_) {}
        }
      }
    } catch (_) {}
  }, 5 * 60 * 1000);

  console.log('[SOMA] 自动触发器已启动');
}

function getSOMAState() {
  return {
    subsystems: {
      painBus: painBus !== null,
      heartd: heartD !== null && heartD.getStatus().running,
      thermo: thermo !== null
    },
    painStats: painBus ? painBus.getStats() : null,
    heartStatus: heartD ? heartD.getStatus() : null,
    systemInfo: thermo ? thermo.getSystemInfo() : null,
    latestSample: thermo ? thermo.getLatest() : null
  };
}

// PainBus 操作
function painEmit(level, source, message, meta) {
  return painBus ? painBus.emit(level, source, message, meta) : null;
}

function painListOpen(level) {
  return painBus ? painBus.listOpen(level) : [];
}

function painListAll() {
  return painBus ? painBus.listAll() : [];
}

function painResolve(id) {
  return painBus ? painBus.resolve(id) : { success: false, error: '未初始化' };
}

function painStats() {
  return painBus ? painBus.getStats() : { total: 0, open: 0, byLevel: { P0:0, P1:0, P2:0, P3:0 } };
}

// Heartbeat 操作
function heartStatus() {
  return heartD ? heartD.getStatus() : { running: false };
}

// Thermo 操作
function thermoLatest() {
  return thermo ? { sample: thermo.getLatest(), systemInfo: thermo.getSystemInfo() } : null;
}

function thermoHistory() {
  return thermo ? thermo.getHistory() : [];
}

function thermoSystemInfo() {
  return thermo ? thermo.getSystemInfo() : null;
}

module.exports = {
  initSOMA,
  getSOMAState,
  painEmit,
  painListOpen,
  painListAll,
  painResolve,
  painStats,
  heartStatus,
  thermoLatest,
  thermoHistory,
  thermoSystemInfo
};
