/**
 * NAS WebDAV 通信模块 (M1)
 * 
 * 提供 NAS WebDAV 读写能力，通过 child_process 调用 curl 或 Node.js 原生 http。
 * 端点：http://100.107.156.33:5005/qclaw/
 * 认证：Basic auth (anima/animastellar)
 */

const http = require('http');
const https = require('https');

const NAS_BASE = 'http://100.107.156.33:5005/qclaw/';
const NAS_AUTH = 'anima:animastellar';

/**
 * 发起 WebDAV 请求
 * @param {string} method - PROPFIND / GET / PUT / DELETE / MKCOL
 * @param {string} relPath - 相对路径（如 memory/2026-07-21.md）
 * @param {string|Buffer} body - 请求体（PUT 时用）
 * @returns {Promise<{status: number, data: any, headers: object}>}
 */
function webdavRequest(method, relPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(NAS_BASE + relPath.replace(/^\/+/, ''));
    const isHttps = url.protocol === 'https:';
    const mod = isHttps ? https : http;

    const authHeader = 'Basic ' + Buffer.from(NAS_AUTH).toString('base64');

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': authHeader,
        'Depth': method === 'PROPFIND' ? '1' : undefined,
        'Content-Type': body ? 'application/octet-stream' : undefined
      },
      timeout: 15000
    };

    // 清理 undefined headers
    Object.keys(options.headers).forEach(k => {
      if (options.headers[k] === undefined) delete options.headers[k];
    });

    const req = mod.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks);
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: method === 'PROPFIND' ? data.toString('utf-8') : data
        });
      });
    });

    req.on('error', (e) => reject(e));
    req.on('timeout', () => { req.destroy(); reject(new Error('WebDAV 请求超时')); });

    if (body) req.write(body);
    req.end();
  });
}

/**
 * 读取 NAS 文件
 * @param {string} relPath - 相对路径
 * @returns {Promise<{success: boolean, content?: string, error?: string}>}
 */
async function nasReadFile(relPath) {
  try {
    const result = await webdavRequest('GET', relPath);
    if (result.status === 200) {
      return { success: true, content: result.data.toString('utf-8') };
    }
    return { success: false, error: `HTTP ${result.status}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * 写入 NAS 文件
 * @param {string} relPath - 相对路径
 * @param {string} content - 文件内容
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function nasWriteFile(relPath, content) {
  try {
    const result = await webdavRequest('PUT', relPath, Buffer.from(content, 'utf-8'));
    if (result.status === 200 || result.status === 201 || result.status === 204) {
      return { success: true };
    }
    return { success: false, error: `HTTP ${result.status}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * 列出 NAS 目录
 * @param {string} relPath - 相对路径
 * @returns {Promise<{success: boolean, files?: Array, error?: string}>}
 */
async function nasListDir(relPath) {
  try {
    const result = await webdavRequest('PROPFIND', relPath || '');
    if (result.status === 207 || result.status === 200) {
      const xml = result.data.toString('utf-8');
      // 简单解析 WebDAV multistatus 响应
      const files = [];
      const hrefRegex = /<d:href>(.*?)<\/d:href>/g;
      const sizeRegex = /<d:getcontentlength>(.*?)<\/d:getcontentlength>/g;
      const typeRegex = /<d:resourcetype>([\s\S]*?)<\/d:resourcetype>/g;
      
      let match;
      const hrefs = [];
      while ((match = hrefRegex.exec(xml)) !== null) {
        hrefs.push(decodeURIComponent(match[1]));
      }
      
      const sizes = [];
      while ((match = sizeRegex.exec(xml)) !== null) {
        sizes.push(parseInt(match[1]) || 0);
      }

      for (let i = 0; i < hrefs.length; i++) {
        const href = hrefs[i];
        const name = href.split('/').filter(Boolean).pop();
        if (name && !href.endsWith('/qclaw/')) {
          files.push({
            name,
            path: href,
            size: sizes[i] || 0,
            isDir: href.endsWith('/')
          });
        }
      }
      
      return { success: true, files };
    }
    return { success: false, error: `HTTP ${result.status}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * 追加内容到 NAS 文件（用于 MEMORY.md 追加）
 * @param {string} relPath - 相对路径
 * @param {string} content - 追加内容
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function nasAppendFile(relPath, content) {
  try {
    // 先读取现有内容
    const readResult = await nasReadFile(relPath);
    let existing = '';
    if (readResult.success) {
      existing = readResult.content;
    }
    // 追加后写回
    const combined = existing + '\n' + content;
    return await nasWriteFile(relPath, combined);
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  nasReadFile,
  nasWriteFile,
  nasListDir,
  nasAppendFile,
  webdavRequest
};
