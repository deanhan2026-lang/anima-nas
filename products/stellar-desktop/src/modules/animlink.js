/**
 * AnimaLink 网络接入模块 (M2)
 * 
 * 桌面启动时自动注册到 AnimaLink，提供节点列表、信任分、令牌历史等 API。
 * AnimaLink 地址：http://127.0.0.1:5053
 */

const http = require('http');

const ANIMALINK_BASE = 'http://127.0.0.1:5053';

/**
 * 调用 AnimaLink API
 * @param {string} method - GET / POST
 * @param {string} endpoint - API 端点（如 /animlink/api/nodes）
 * @param {object} body - POST 请求体
 * @returns {Promise<object>}
 */
function animlinkRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(ANIMALINK_BASE + endpoint);

    const options = {
      hostname: url.hostname,
      port: url.port || 5053,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
          resolve({ status: res.statusCode, data });
        } catch (e) {
          resolve({ status: res.statusCode, data: Buffer.concat(chunks).toString('utf-8') });
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.on('timeout', () => { req.destroy(); reject(new Error('AnimaLink 请求超时')); });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * 获取节点列表
 * @returns {Promise<{success: boolean, nodes?: Array, error?: string}>}
 */
async function animlinkGetNodes() {
  try {
    const result = await animlinkRequest('GET', '/animlink/api/nodes');
    if (result.status === 200) {
      return { success: true, nodes: result.data.nodes || result.data };
    }
    return { success: false, error: `HTTP ${result.status}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * 获取信任分
 * @returns {Promise<{success: boolean, scores?: object, error?: string}>}
 */
async function animlinkGetTrust() {
  try {
    const result = await animlinkRequest('GET', '/animlink/api/trust');
    if (result.status === 200) {
      return { success: true, scores: result.data.scores || result.data };
    }
    return { success: false, error: `HTTP ${result.status}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * 获取令牌历史
 * @returns {Promise<{success: boolean, tokens?: Array, error?: string}>}
 */
async function animlinkGetTokens() {
  try {
    const result = await animlinkRequest('GET', '/animlink/api/tokens');
    if (result.status === 200) {
      return { success: true, tokens: result.data.tokens || result.data };
    }
    return { success: false, error: `HTTP ${result.status}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * 发送令牌
 * @param {object} params - { to, type, amount }
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function animlinkSendToken(params) {
  try {
    const result = await animlinkRequest('POST', '/animlink/api/tokens/send', params);
    if (result.status === 200 || result.status === 201) {
      return { success: true };
    }
    return { success: false, error: `HTTP ${result.status}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * 注册节点到 AnimaLink
 * @param {object} nodeInfo - { id, label, did, status }
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function animlinkRegisterNode(nodeInfo) {
  try {
    const result = await animlinkRequest('POST', '/animlink/api/nodes/register', nodeInfo);
    if (result.status === 200 || result.status === 201) {
      return { success: true };
    }
    return { success: false, error: `HTTP ${result.status}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  animlinkGetNodes,
  animlinkGetTrust,
  animlinkGetTokens,
  animlinkSendToken,
  animlinkRegisterNode
};
