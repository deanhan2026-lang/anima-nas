/**
 * 长期记忆模块 (M4)
 * 
 * 对话结束后自动整理关键信息，追加到 MEMORY.md（本地 + NAS 同步）。
 */

const fs = require('fs');
const path = require('path');
const { nasWriteFile, nasAppendFile, nasReadFile } = require('./nas_webdav');

/**
 * 从对话中提取关键信息（简单规则版）
 * @param {Array} messages - 对话消息列表 [{role, content}]
 * @returns {string} 提取的摘要
 */
function summarizeConversation(messages) {
  if (!messages || messages.length === 0) return '';

  const lines = [];
  const timestamp = new Date().toISOString();

  // 提取用户问题和 AI 回答的关键点
  for (const msg of messages) {
    if (msg.role === 'user') {
      // 截取用户问题前 100 字符
      const q = msg.content.substring(0, 100);
      lines.push(`Q: ${q}${msg.content.length > 100 ? '...' : ''}`);
    } else if (msg.role === 'assistant') {
      // 提取 AI 回答中的关键事实（句号分割）
      const sentences = msg.content.split(/[。.!！]/).filter(s => s.trim().length > 10);
      const keyFacts = sentences.slice(0, 3).map(s => s.trim());
      if (keyFacts.length > 0) {
        lines.push(`A: ${keyFacts.join('。')}`);
      }
    }
  }

  if (lines.length === 0) return '';

  return `## 对话摘要 ${timestamp}\n${lines.join('\n')}\n`;
}

/**
 * 保存记忆到本地
 * @param {string} appDataPath - Electron userData 路径
 * @param {string} summary - 摘要内容
 * @returns {{success: boolean, error?: string}}
 */
function saveMemoryLocal(appDataPath, summary) {
  try {
    const animaDir = path.join(appDataPath, '.anima');
    if (!fs.existsSync(animaDir)) {
      fs.mkdirSync(animaDir, { recursive: true });
    }
    const memoryFile = path.join(animaDir, 'MEMORY.md');
    fs.appendFileSync(memoryFile, '\n' + summary, 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * 同步记忆到 NAS
 * @param {string} summary - 摘要内容
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function syncMemoryToNAS(summary) {
  try {
    const today = new Date().toISOString().split('T')[0]; // 2026-07-21
    const relPath = `memory/${today}.md`;
    return await nasAppendFile(relPath, summary);
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * 读取本地记忆
 * @param {string} appDataPath - Electron userData 路径
 * @returns {{success: boolean, content?: string, error?: string}}
 */
function readMemoryLocal(appDataPath) {
  try {
    const animaDir = path.join(appDataPath, '.anima');
    const memoryFile = path.join(animaDir, 'MEMORY.md');
    if (!fs.existsSync(memoryFile)) {
      return { success: true, content: '' };
    }
    const content = fs.readFileSync(memoryFile, 'utf-8');
    return { success: true, content };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * 从 NAS 读取记忆
 * @param {string} dateStr - 日期字符串（如 2026-07-21）
 * @returns {Promise<{success: boolean, content?: string, error?: string}>}
 */
async function readMemoryFromNAS(dateStr) {
  try {
    const relPath = dateStr ? `memory/${dateStr}.md` : 'memory/';
    return await nasReadFile(relPath);
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  summarizeConversation,
  saveMemoryLocal,
  syncMemoryToNAS,
  readMemoryLocal,
  readMemoryFromNAS
};
