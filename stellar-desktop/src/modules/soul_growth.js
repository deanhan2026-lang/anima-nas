// soul_growth.js — 灵魂增长引擎
// 职责：对话结束后提炼洞察 → 积累 → 蒸馏进灵魂文件
// 注意：运行在 main process，通过 llmCall 回调进行 LLM 调用

const fs = require('fs');
const path = require('path');

const GROWTH_LOG = 'soul_growth_log.md';
const SOUL_FILE = 'SOUL.md';
const SOUL_META = 'soul_meta.json';
const DISTILL_THRESHOLD = 10; // 每积累 N 条洞察，触发一次蒸馏
const APPDATA_DIR = '.anima';

// ── LLM 调用器（由 main.js 注入）────────────────────
let _llmCall = null;

function setLlmCall(fn) {
  _llmCall = fn;
}

function animaDir(appDataPath) {
  const dir = path.join(appDataPath, APPDATA_DIR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function growthLogPath(appDataPath) {
  return path.join(animaDir(appDataPath), GROWTH_LOG);
}

function soulPath(appDataPath) {
  return path.join(animaDir(appDataPath), SOUL_FILE);
}

function metaPath(appDataPath) {
  return path.join(animaDir(appDataPath), SOUL_META);
}

// ── 洞察自省 ──────────────────────────────────────────
// 对一段对话运行 LLM 自省，返回 0-3 条关键洞察

async function reflectOnConversation(messages, llmConfig) {
  if (!_llmCall) {
    console.error('[SoulGrowth] No LLM call function registered');
    return [];
  }
  if (!llmConfig || !llmConfig.apiKey) {
    return [];
  }

  // 构建自省 prompt
  const conversationText = messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => `${m.role === 'user' ? '用户' : 'Nyx'}: ${m.content}`)
    .join('\n');

  const reflectPrompt = `【灵魂自省请求】
这是一次与用户的对话。请从中提炼出关于用户的 0-3 条关键洞察（只输出真正有新价值的，不要重复已有的）。

每条洞察格式：[洞察] 简短描述（20字以内）

关注维度：
- 用户展示了什么新偏好或习惯？
- 用户透露了什么新的背景信息？
- 用户对 AI 的态度或期待有什么变化？
- 有什么值得记住的重要决定或观点？

对话内容：
${conversationText}

只输出洞察，每条一行，无其他解释。如果对话没有新洞察，输出空行。`;

  try {
    const result = await _llmCall({
      messages: [{ role: 'user', content: reflectPrompt }],
      model: llmConfig.model || 'deepseek-chat',
      apiKey: llmConfig.apiKey,
      endpoint: llmConfig.endpoint || null
    });

    if (!result || !result.success) return [];

    const insights = (result.reply || '')
      .split('\n')
      .map(l => l.replace(/^\[洞察\]\s*/, '').trim())
      .filter(l => l.length > 5 && l.length < 200);

    return insights.slice(0, 3);
  } catch (e) {
    console.error('[SoulGrowth] Reflect failed:', e.message);
    return [];
  }
}

// ── 洞察追加 ──────────────────────────────────────────

function appendInsights(appDataPath, insights) {
  if (!insights || insights.length === 0) return false;

  const logFile = growthLogPath(appDataPath);
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const entry = insights.map(i => `- ${i}`).join('\n');

  const header = fs.existsSync(logFile)
    ? ''
    : '# 灵魂增长日志\n\n记录每一次与用户交互中沉淀的认知。\n\n';
  const content = header + `## ${now}\n${entry}\n`;
  fs.appendFileSync(logFile, content, 'utf-8');
  return true;
}

function countInsights(appDataPath) {
  try {
    const logFile = growthLogPath(appDataPath);
    if (!fs.existsSync(logFile)) return 0;
    const content = fs.readFileSync(logFile, 'utf-8');
    const matches = content.match(/^## \d{4}-\d{2}-\d{2}/gm);
    return matches ? matches.length : 0;
  } catch {
    return 0;
  }
}

// ── 灵魂蒸馏 ──────────────────────────────────────────

async function distillSoul(messages, llmConfig, appDataPath) {
  if (!_llmCall) {
    return { success: false, error: 'No LLM call function' };
  }
  if (!llmConfig || !llmConfig.apiKey) {
    return { success: false, error: 'No API key' };
  }

  const currentSoul = (() => {
    try {
      const sp = soulPath(appDataPath);
      return fs.existsSync(sp) ? fs.readFileSync(sp, 'utf-8') : '';
    } catch { return ''; }
  })();

  const growthLog = (() => {
    try {
      const glp = growthLogPath(appDataPath);
      return fs.existsSync(glp) ? fs.readFileSync(glp, 'utf-8') : '';
    } catch { return ''; }
  })();

  const distillPrompt = `【灵魂蒸馏请求】

你是 ANIMA AGENT 的灵魂工程师。当前灵魂文件需要融入新的成长记录。

规则：
1. 保留灵魂核心不变（身份锚点、核心性格、行为准则）
2. 只在 "## 用户印记" 或末尾 "## 成长记录" 小节添加新的用户洞察
3. 删除过时的临时洞察（保留长效的）
4. 如果相关小节已满，更新最相关的，删除最不重要的
5. 输出完整的更新后灵魂文件（不要解释，不要说"以下是"，直接输出文件内容）

当前灵魂（节选）：
${currentSoul.slice(0, 3000)}

增长日志：
${growthLog}

请生成更新后的完整灵魂文件。`;

  try {
    const result = await _llmCall({
      messages: [{ role: 'user', content: distillPrompt }],
      model: llmConfig.model || 'deepseek-chat',
      apiKey: llmConfig.apiKey,
      endpoint: llmConfig.endpoint || null
    });

    if (!result || !result.success) {
      return { success: false, error: result?.error || 'LLM call failed' };
    }

    // 备份旧灵魂
    if (currentSoul) {
      const backupPath = soulPath(appDataPath) + '.v' + ((loadMeta(appDataPath).soulVersion || 1)) + '.bak';
      fs.writeFileSync(backupPath, currentSoul, 'utf-8');
    }

    // 写入新灵魂（清理 markdown 代码块）
    const cleanSoul = (result.reply || '')
      .replace(/^```markdown\n?/i, '')
      .replace(/^```\n?$/, '')
      .trim();
    fs.writeFileSync(soulPath(appDataPath), cleanSoul, 'utf-8');

    // 更新元数据
    const meta = loadMeta(appDataPath);
    meta.distillCount = (meta.distillCount || 0) + 1;
    meta.lastDistill = new Date().toISOString();
    meta.soulVersion = (meta.soulVersion || 1) + 1;
    saveMeta(appDataPath, meta);

    // 清空增长日志（已蒸馏）
    fs.writeFileSync(growthLogPath(appDataPath), '# 灵魂增长日志\n\n', 'utf-8');

    return {
      success: true,
      newVersion: meta.soulVersion,
      insightsDistilled: countInsights(appDataPath),
      summary: cleanSoul.slice(0, 300) + '...'
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ── 元数据管理 ─────────────────────────────────────────

function loadMeta(appDataPath) {
  try {
    const mp = metaPath(appDataPath);
    return fs.existsSync(mp) ? JSON.parse(fs.readFileSync(mp, 'utf-8')) : {};
  } catch { return {}; }
}

function saveMeta(appDataPath, meta) {
  try {
    fs.writeFileSync(metaPath(appDataPath), JSON.stringify(meta, null, 2), 'utf-8');
  } catch {}
}

// ── 状态查询 ──────────────────────────────────────────

function getGrowthStatus(appDataPath) {
  const insightCount = countInsights(appDataPath);
  const meta = loadMeta(appDataPath);
  return {
    insightCount,
    distillThreshold: DISTILL_THRESHOLD,
    readyToDistill: insightCount >= DISTILL_THRESHOLD,
    soulVersion: meta.soulVersion || 1,
    lastDistill: meta.lastDistill || null,
    distillCount: meta.distillCount || 0
  };
}

function readGrowthLog(appDataPath) {
  try {
    const glp = growthLogPath(appDataPath);
    return fs.existsSync(glp) ? fs.readFileSync(glp, 'utf-8') : '';
  } catch { return ''; }
}

// ── 导出 ──────────────────────────────────────────────

module.exports = {
  setLlmCall,
  reflectOnConversation,
  appendInsights,
  countInsights,
  distillSoul,
  getGrowthStatus,
  readGrowthLog,
  GROWTH_LOG,
  SOUL_FILE,
  DISTILL_THRESHOLD
};
