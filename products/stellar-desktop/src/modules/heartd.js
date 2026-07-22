/**
 * Heartbeat — 心跳守护模块 (P1)
 * 
 * 每 5 分钟上报心跳到 AnimaLink，更新 lastSeen。
 * 失联检测：15 分钟未上报标记为可疑。
 */

const fs = require('fs');
const path = require('path');

const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 分钟
const STALE_THRESHOLD = 15 * 60 * 1000;   // 15 分钟

class HeartDaemon {
  constructor(animaDir) {
    this.animaDir = animaDir;
    this.heartFile = path.join(animaDir, 'heartbeat.json');
    this._timer = null;
    this._animlinkClient = null;
    this._onStale = null;
  }

  /**
   * 设置 AnimaLink 客户端引用
   */
  setAnimlinkClient(client) {
    this._animlinkClient = client;
  }

  /**
   * 设置失联回调
   */
  onStale(callback) {
    this._onStale = callback;
  }

  /**
   * 启动心跳
   */
  start() {
    // 立即上报一次
    this._beat();
    
    // 每 5 分钟上报
    this._timer = setInterval(() => this._beat(), HEARTBEAT_INTERVAL);
    
    // 每 5 分钟检查失联
    this._staleTimer = setInterval(() => this._checkStale(), HEARTBEAT_INTERVAL);

    console.log('[HeartD] 心跳守护已启动');
    return { success: true };
  }

  /**
   * 停止心跳
   */
  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    if (this._staleTimer) {
      clearInterval(this._staleTimer);
      this._staleTimer = null;
    }
    console.log('[HeartD] 心跳守护已停止');
  }

  /**
   * 上报一次心跳
   */
  async _beat() {
    const now = new Date().toISOString();
    const beat = {
      lastBeat: now,
      processUptime: process.uptime(),
      pid: process.pid
    };

    // 写本地
    try {
      if (!fs.existsSync(this.animaDir)) {
        fs.mkdirSync(this.animaDir, { recursive: true });
      }
      fs.writeFileSync(this.heartFile, JSON.stringify(beat, null, 2), 'utf-8');
    } catch (_) {}

    // 上报到 AnimaLink
    if (this._animlinkClient) {
      try {
        await this._animlinkClient.animlinkRegisterNode({
          id: `stellar-nyx-desktop`,
          label: 'STELLAR NYX Desktop',
          status: 'active',
          lastSeen: now
        });
      } catch (err) {
        console.log('[HeartD] AnimaLink 不可达:', err.message);
      }
    }
  }

  /**
   * 检查失联
   */
  _checkStale() {
    try {
      if (fs.existsSync(this.heartFile)) {
        const data = JSON.parse(fs.readFileSync(this.heartFile, 'utf-8'));
        const elapsed = Date.now() - new Date(data.lastBeat).getTime();
        if (elapsed > STALE_THRESHOLD && this._onStale) {
          this._onStale({
            lastBeat: data.lastBeat,
            elapsedMs: elapsed,
            isStale: true
          });
        }
      }
    } catch (_) {}
  }

  /**
   * 获取心跳状态
   */
  getStatus() {
    try {
      if (fs.existsSync(this.heartFile)) {
        const data = JSON.parse(fs.readFileSync(this.heartFile, 'utf-8'));
        const elapsed = Date.now() - new Date(data.lastBeat).getTime();
        return {
          running: this._timer !== null,
          lastBeat: data.lastBeat,
          uptime: data.processUptime,
          elapsedSec: Math.floor(elapsed / 1000),
          isStale: elapsed > STALE_THRESHOLD,
          pid: data.pid
        };
      }
    } catch (_) {}
    return { running: this._timer !== null, lastBeat: null };
  }
}

module.exports = { HeartDaemon, HEARTBEAT_INTERVAL };
