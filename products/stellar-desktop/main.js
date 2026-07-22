/**

 * STELLAR NYX 1.0 — Electron Main Process

 * 

 * ANIMA Identity Desktop Node

 * Main process: window management, IPC handlers, crypto operations, file I/O

 */



const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');

const path = require('path');

const fs = require('fs');

const crypto = require('crypto');

const nasWebdav = require('./src/modules/nas_webdav');

const animlink = require('./src/modules/animlink');

const memory = require('./src/modules/memory');

const soma = require('./src/modules/soma_integration');



// ──────────────────────────────────────────────

// Constants

// ──────────────────────────────────────────────

const APP_NAME = 'STELLAR NYX 1.0';

const ANIMA_DIR = path.join(app.getPath('userData'), '.anima');

const DID_FILE = path.join(ANIMA_DIR, 'did_private_key.json');

const REGISTRY_FILE = path.join(ANIMA_DIR, 'node_registry.json');

const CONFIG_FILE = path.join(ANIMA_DIR, 'config.json');

const ATTESTATION_FILE = path.join(ANIMA_DIR, 'attestation.json');

const PERSONA_DIR = path.join(ANIMA_DIR, 'persona');



let mainWindow = null;



// ──────────────────────────────────────────────

// Ensure .anima directory exists

// ──────────────────────────────────────────────

function ensureAnimaDir() {

  [ANIMA_DIR, PERSONA_DIR].forEach(d => {

    if (!fs.existsSync(d)) {

      fs.mkdirSync(d, { recursive: true });

    }

  });

}



// ──────────────────────────────────────────────

// Base58 encoding (for DID:key format)

// ──────────────────────────────────────────────

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function encodeBase58(buf) {

  let carry, digits = [0];

  for (let i = 0; i < buf.length; i++) {

    carry = buf[i];

    for (let j = 0; j < digits.length; j++) {

      carry += digits[j] << 8;

      digits[j] = carry % 58;

      carry = (carry / 58) | 0;

    }

    while (carry) {

      digits.push(carry % 58);

      carry = (carry / 58) | 0;

    }

  }

  for (let i = 0; buf[i] === 0 && i < buf.length - 1; i++) {

    digits.push(0);

  }

  return digits.reverse().map(d => ALPHABET[d]).join('');

}



// ──────────────────────────────────────────────

// IPC Handlers: DID Generation

// ──────────────────────────────────────────────

ipcMain.handle('did:generate', async () => {

  try {

    ensureAnimaDir();



    // Generate Ed25519 keypair

    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {

      publicKeyEncoding: { type: 'spki', format: 'der' },

      privateKeyEncoding: { type: 'pkcs8', format: 'der' }

    });



    // Extract raw 32-byte public key from SPKI DER (skip 12-byte header)

    const rawPubkey = publicKey.slice(-32);

    const pubkeyHex = rawPubkey.toString('hex');

    const privkeyHex = privateKey.toString('hex');



    // Generate DID:key

    const did = `did:key:z${encodeBase58(rawPubkey)}`;

    const timestamp = new Date().toISOString();



    // Save DID document

    const didDoc = {

      did,

      publicKeyHex: pubkeyHex,

      privateKeyHex: privkeyHex,

      created: timestamp,

      method: 'ed25519',

      label: '',

      attestations: []

    };



    fs.writeFileSync(DID_FILE, JSON.stringify(didDoc, null, 2), 'utf-8');



    console.log(`✅ DID 已生成：${did}`);

    console.log(`⚠️  私钥已保存到 ${DID_FILE}`);



    return {

      success: true,

      did,

      publicKeyHex: pubkeyHex,

      created: timestamp,

      warning: '请妥善保管私钥文件，丢失后将无法恢复身份'

    };

  } catch (err) {

    console.error('❌ DID 生成失败:', err.message);

    return { success: false, error: err.message };

  }

});



// ──────────────────────────────────────────────

// IPC Handlers: Check DID status

// ──────────────────────────────────────────────

ipcMain.handle('did:status', async () => {

  try {

    if (!fs.existsSync(DID_FILE)) {

      return { exists: false };

    }

    const raw = fs.readFileSync(DID_FILE, 'utf-8');

    const didDoc = JSON.parse(raw);

    return {

      exists: true,

      did: didDoc.did,

      publicKeyHex: didDoc.publicKeyHex,

      created: didDoc.created,

      label: didDoc.label,

      attestations: didDoc.attestations || []

    };

  } catch (err) {

    return { exists: false, error: err.message };

  }

});



// ──────────────────────────────────────────────

// IPC Handlers: Carbon Binding (WeChat attestation)

// ──────────────────────────────────────────────

ipcMain.handle('carbon:bind', async (event, wechatOpenId) => {

  try {

    ensureAnimaDir();



    if (!fs.existsSync(DID_FILE)) {

      return { success: false, error: '请先生成 DID' };

    }



    const didDoc = JSON.parse(fs.readFileSync(DID_FILE, 'utf-8'));



    // 1. Hash the wechat openid (SHA-256)

    const guardianHash = crypto.createHash('sha256').update(wechatOpenId).digest('hex');



    // 2. Sign the DID using the agent's Ed25519 private key

    //    (In real flow, the carbon user signs the DID with their own key)

    //    Here we simulate with the agent's private key for the attestation

    const privateKeyObj = crypto.createPrivateKey({

      key: Buffer.from(didDoc.privateKeyHex, 'hex'),

      format: 'der',

      type: 'pkcs8'

    });



    const message = Buffer.from(didDoc.did, 'utf-8');

    const signature = crypto.sign(null, message, privateKeyObj);

    const signatureHex = signature.toString('hex');



    // 3. Build attestation

    const attestation = {

      id: `att_${crypto.randomUUID()}`,

      guardian_type: 'wechat',

      guardian_hash: `sha256:${guardianHash}`,

      bound_at: new Date().toISOString(),

      signature: signatureHex,

      level: 'owner'

    };



    // 4. Write attestation to DID document

    if (!didDoc.attestations) {

      didDoc.attestations = [];

    }

    didDoc.attestations.push(attestation);

    fs.writeFileSync(DID_FILE, JSON.stringify(didDoc, null, 2), 'utf-8');



    // 5. Also save standalone attestation record

    fs.writeFileSync(ATTESTATION_FILE, JSON.stringify({

      attestations: didDoc.attestations,

      trust_seed: 0.5,

      did: didDoc.did

    }, null, 2), 'utf-8');



    // 6. Verify the signature

    const publicKeyObj = crypto.createPublicKey({

      key: Buffer.from(didDoc.publicKeyHex, 'hex'),

      format: 'der',

      type: 'spki'

    });

    const isValid = crypto.verify(null, message, publicKeyObj, signature);

    

    console.log(`✅ 碳基绑定完成：${attestation.id}`);

    console.log(`✅ 签名验证：${isValid ? '通过' : '失败'}`);



    return {

      success: true,

      attestation,

      trustSeed: 0.5,

      signatureValid: isValid,

      message: isValid

        ? '✅ 碳基绑定成功！信任分种子：0.5'

        : '⚠️ 绑定完成但签名验证失败'

    };

  } catch (err) {

    console.error('❌ 碳基绑定失败:', err.message);

    return { success: false, error: err.message };

  }

});



// ──────────────────────────────────────────────

// IPC Handlers: ANIMA Identity Registration

// ──────────────────────────────────────────────

ipcMain.handle('identity:register', async (event, label) => {

  try {

    ensureAnimaDir();

    if (!fs.existsSync(DID_FILE)) {

      return { success: false, error: '请先生成 DID' };

    }



    const didDoc = JSON.parse(fs.readFileSync(DID_FILE, 'utf-8'));

    

    // Build registration payload

    const payload = {

      did: didDoc.did,

      public_key_hex: didDoc.publicKeyHex,

      label: label || 'STELLAR NYX 节点',

      registered_at: new Date().toISOString(),

      node_type: 'distilled',

      package_ref: 'STELLAR_NYX_1.0',

      attestations: didDoc.attestations || [],

      trust_seed: (didDoc.attestations && didDoc.attestations.length > 0) ? 0.5 : 0.0,

      status: 'active'

    };



    // Save to local registry

    let registry = { nodes: {} };

    if (fs.existsSync(REGISTRY_FILE)) {

      try {

        registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'));

      } catch (e) {

        registry = { nodes: {} };

      }

    }



    const nodeId = `stellar-nyx-${Date.now()}`;

    registry.nodes[nodeId] = {

      node_id: nodeId,

      ...payload,

      last_seen: new Date().toISOString()

    };



    // Update schema metadata

    registry.schema = 'anima-link-registry-v1';

    registry.updated_at = new Date().toISOString();



    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2), 'utf-8');



    // Also update config

    updateConfig({ registered: true, nodeId, registeredAt: payload.registered_at });



    // Update DID doc label

    didDoc.label = label || 'STELLAR NYX 节点';

    fs.writeFileSync(DID_FILE, JSON.stringify(didDoc, null, 2), 'utf-8');



    // Try to register with ANIMA Identity Gateway (local service at 127.0.0.1:5050)

    let gatewayResult = null;

    try {

      const httpMod = require('http');

      const response = await new Promise((resolve, reject) => {

        const req = httpMod.request({

          hostname: '127.0.0.1',

          port: 5050,

          path: '/api/identity/register',

          method: 'POST',

          headers: { 'Content-Type': 'application/json' },

          timeout: 3000

        }, (res) => {

          let body = '';

          res.on('data', chunk => body += chunk);

          res.on('end', () => resolve({ status: res.statusCode, body }));

        });

        req.on('error', (e) => reject(e));

        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });

        req.write(JSON.stringify(payload));

        req.end();

      });

      gatewayResult = { success: true, status: response.status, body: response.body };

    } catch (gatewayErr) {

      gatewayResult = { 

        success: false, 

        message: '本地 ANIMA 网关未运行（可选），注册信息已保存在本地。',

        detail: gatewayErr.message

      };

    }



    return {

      success: true,

      nodeId,

      did: didDoc.did,

      label: payload.label,

      trustSeed: payload.trust_seed,

      registeredAt: payload.registered_at,

      gateway: gatewayResult

    };

  } catch (err) {

    console.error('❌ Identity 注册失败:', err.message);

    return { success: false, error: err.message };

  }

});



// ──────────────────────────────────────────────

// IPC Handlers: Identity status

// ──────────────────────────────────────────────

ipcMain.handle('identity:status', async () => {

  try {

    let registry = { nodes: {} };

    if (fs.existsSync(REGISTRY_FILE)) {

      registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'));

    }



    let didDoc = null;

    if (fs.existsSync(DID_FILE)) {

      didDoc = JSON.parse(fs.readFileSync(DID_FILE, 'utf-8'));

    }



    let config = {};

    if (fs.existsSync(CONFIG_FILE)) {

      config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));

    }



    const nodeIds = Object.keys(registry.nodes);

    const activeNode = nodeIds.length > 0 ? registry.nodes[nodeIds[nodeIds.length - 1]] : null;



    return {

      registered: config.registered || false,

      nodeId: activeNode ? activeNode.node_id : null,

      did: didDoc ? didDoc.did : null,

      didCreated: didDoc ? didDoc.created : null,

      label: activeNode ? activeNode.label : null,

      trustSeed: activeNode ? activeNode.trust_seed : 0,

      attestationCount: didDoc && didDoc.attestations ? didDoc.attestations.length : 0,

      registeredAt: config.registeredAt || null

    };

  } catch (err) {

    return { error: err.message };

  }

});



// ──────────────────────────────────────────────

// IPC Handlers: LLM Config

// ──────────────────────────────────────────────

ipcMain.handle('llm:saveConfig', async (event, llmConfig) => {

  try {

    ensureAnimaDir();

    const currentConfig = loadConfig();

    currentConfig.llm = llmConfig;

    fs.writeFileSync(CONFIG_FILE, JSON.stringify(currentConfig, null, 2), 'utf-8');

    return { success: true };

  } catch (err) {

    return { success: false, error: err.message };

  }

});



ipcMain.handle('llm:loadConfig', async () => {

  try {

    const config = loadConfig();

    return { success: true, config: config.llm || null };

  } catch (err) {

    return { success: false, config: null, error: err.message };

  }

});



ipcMain.handle('llm:testConnection', async (event, { apiKey, endpoint, model }) => {

  try {

    const endpointUrl = endpoint || 'https://api.deepseek.com/v1/chat/completions';

    const url = new URL(endpointUrl);

    const isHttps = url.protocol === 'https:';

    const httpMod = require(isHttps ? 'https' : 'http');

    

    const response = await new Promise((resolve, reject) => {

      const req = httpMod.request({

        hostname: url.hostname,

        port: url.port || (isHttps ? 443 : 80),

        path: url.pathname + url.search,

        method: 'POST',

        headers: {

          'Content-Type': 'application/json',

          'Authorization': `Bearer ${apiKey}`

        },

        timeout: 10000

      }, (res) => {

        let body = '';

        res.on('data', chunk => body += chunk);

        res.on('end', () => resolve({ status: res.statusCode, body: body.substring(0, 200) }));

      });

      req.on('error', (e) => reject(e));

      req.on('timeout', () => { req.destroy(); reject(new Error('连接超时')); });

      req.write(JSON.stringify({

        model: model || 'deepseek-chat',

        messages: [{ role: 'user', content: 'Hello' }],

        max_tokens: 5

      }));

      req.end();

    });



    // Parse body for actual errors even when HTTP 200

    let detail = response.body;

    let success = response.status < 400;

    let message = response.status < 400 ? '✅ 连接成功' : `⚠️ 连接异常 (HTTP ${response.status})`;

    

    try {

      const bodyJson = JSON.parse(response.body);

      if (bodyJson.error) {

        success = false;

        message = `⚠️ API 返回错误: ${bodyJson.error.message || JSON.stringify(bodyJson.error)}`;

        detail = JSON.stringify(bodyJson.error).substring(0, 300);

      }

    } catch (_) {}

    

    return { success, status: response.status, message, detail };

  } catch (err) {

    return { success: false, status: 0, message: `❌ 连接失败: ${err.message}` };

  }

});



// ──────────────────────────────────────────────

// IPC Handlers: Echo Test (IPC 链路验证)

// ──────────────────────────────────────────────

ipcMain.handle('llm:echo', async (event, msg) => {

  return { success: true, reply: `✅ IPC 链路正常。你发送了: ${JSON.stringify(msg).substring(0, 200)}` };

});



// ──────────────────────────────────────────────

// IPC Handlers: LLM Chat

// ──────────────────────────────────────────────

ipcMain.handle('llm:chat', async (event, { messages, model, apiKey, endpoint }) => {

  // Write debug log

  try {

    const logDir = path.join(app.getPath('userData'), '.anima');

    fs.mkdirSync(logDir, { recursive: true });

    fs.appendFileSync(path.join(logDir, 'chat_debug.log'),

      `[${new Date().toISOString()}] START model=${model} msgs=${messages ? messages.length : 0}\n`);

  } catch (_) {}



  try {

    const ep = endpoint || 'https://api.deepseek.com/v1/chat/completions';

    const key = apiKey || (loadConfig().llm || {}).apiKey || '';

    const mdl = model || (loadConfig().llm || {}).model || 'deepseek-chat';



    if (!key) {

      return { success: false, error: '未配置 API Key' };

    }



    // Inject persona system prompt if loaded
    const cfgP = loadConfig();
    if (cfgP.persona && cfgP.persona.filePath) {
      const pd = app.getPath('userData');
      const pn = path.basename(cfgP.persona.filePath);
      let pf = path.join(pd, '.anima', 'persona', pn);
      if (!fs.existsSync(pf)) pf = cfgP.persona.filePath;
      if (fs.existsSync(pf)) {
        try {
          let soul = '';
          const sps = ['SOUL.md', 'SOUL.distilled.md', 'STELLAR_NYX_1.0/persona/SOUL.distilled.md'];
          for (const sp of sps) {
            try {
              const r = require('child_process').execSync(
                'tar -xzf "' + pf + '" -O ' + sp + ' 2>nul',
                { encoding: 'utf-8', timeout: 5000, windowsHide: true }
              ).trim();
              if (r) { soul = r; break; }
            } catch (_) {}
          }
          if (soul && messages && Array.isArray(messages)) {
            try { fs.appendFileSync(path.join(app.getPath('userData'), '.anima', 'chat_debug.log'),
              '[PERSONA] Injected: ' + soul.substring(0, 60) + '... msg_count=' + messages.length + chr(10)); } catch (_) {}
            const si = messages.findIndex(m => m.role === 'system');
            const sys = { role: 'system', content: soul };
            if (si >= 0) messages[si] = sys;
            else messages.unshift(sys);
          }
        } catch (_) {}
      }
    }

    // Use model from config directly (not from dropdown if endpoint is different from default)

    let finalModel = mdl;

    let finalEndpoint = ep;

    if (ep.includes('api.deepseek.com')) {

      finalModel = 'deepseek-chat';

    } else if (ep.includes('api.openai.com')) {

      finalModel = 'gpt-4o';

    }

    // For any other endpoint, use the model as-is from config



    const url = new URL(finalEndpoint);

    const isHttps = url.protocol === 'https:';

    const httpMod = require(isHttps ? 'https' : 'http');



    const response = await new Promise((resolve, reject) => {

      const req = httpMod.request({

        hostname: url.hostname,

        port: url.port || (isHttps ? 443 : 80),

        path: url.pathname + url.search,  // ← include url.search like testConnection

        method: 'POST',

        headers: {

          'Content-Type': 'application/json',

          'Authorization': `Bearer ${key}`

        },

        timeout: 15000

      }, (res) => {

        let body = '';

        res.on('data', chunk => body += chunk);

        res.on('end', () => resolve({ status: res.statusCode, body }));

        res.on('error', e => reject(e));

      });

      req.on('error', (e) => {

        try { fs.appendFileSync(path.join(app.getPath('userData'), '.anima', 'chat_debug.log'),

          `[${new Date().toISOString()}] REQUEST ERROR: ${e.message}\n`); } catch (_) {}

        reject(e);

      });

      req.on('timeout', () => {

        try { fs.appendFileSync(path.join(app.getPath('userData'), '.anima', 'chat_debug.log'),

          `[${new Date().toISOString()}] TIMEOUT\n`); } catch (_) {}

        req.destroy();

        reject(new Error('请求超时'));

      });

      try {

        const body = JSON.stringify({ model: finalModel, messages, max_tokens: 4096, temperature: 0.7 });

        req.write(body);

        req.end();

      } catch (writeErr) {

        reject(writeErr);

      }

    });



    if (response.status >= 400) {

      return { success: false, error: `API ${response.status}: ${response.body.substring(0, 200)}` };

    }



    let data;

    try {

      data = JSON.parse(response.body);

    } catch (parseErr) {

      return { success: false, error: `JSON 解析失败: ${response.body.substring(0, 200)}` };

    }



    if (data.error) {

      return { success: false, error: `API 错误: ${data.error.message || JSON.stringify(data.error)}` };

    }



    // Extract reply

    let reply = '';

    if (data.choices && data.choices.length > 0) {

      const c = data.choices[0];

      if (c.message && c.message.content) reply = c.message.content;

      else if (c.text) reply = c.text;

      else if (c.delta && c.delta.content) reply = c.delta.content;

      else reply = '[原始] ' + JSON.stringify(c).substring(0, 500);

    } else if (data.content) {

      reply = data.content;

    } else {

      reply = '[响应] ' + JSON.stringify(data).substring(0, 500);

    }



    try { fs.appendFileSync(path.join(app.getPath('userData'), '.anima', 'chat_debug.log'),

      `[${new Date().toISOString()}] SUCCESS replyLen=${reply.length}\n`); } catch (_) {}



    return { success: true, reply };

  } catch (err) {

    try { fs.appendFileSync(path.join(app.getPath('userData'), '.anima', 'chat_debug.log'),

      `[${new Date().toISOString()}] CATCH: ${err.message}\n`); } catch (_) {}

    return { success: false, error: err.message };

  }

});



// ──────────────────────────────────────────────

// IPC Handlers: Conversation Management

// ──────────────────────────────────────────────

const CONV_DIR = path.join(app.getPath('userData'), '.anima', 'conversations');



function ensureConvDir() {

  if (!fs.existsSync(CONV_DIR)) fs.mkdirSync(CONV_DIR, { recursive: true });

}



ipcMain.handle('conversation:save', async (event, { id, title, messages }) => {

  try {

    ensureConvDir();

    const conv = { id, title, messages, updatedAt: new Date().toISOString() };

    fs.writeFileSync(path.join(CONV_DIR, `${id}.json`), JSON.stringify(conv, null, 2), 'utf-8');

    return { success: true };

  } catch (err) {

    return { success: false, error: err.message };

  }

});



ipcMain.handle('conversation:load', async (event, id) => {

  try {

    ensureConvDir();

    const raw = fs.readFileSync(path.join(CONV_DIR, `${id}.json`), 'utf-8');

    return { success: true, conversation: JSON.parse(raw) };

  } catch (err) {

    return { success: false, error: err.message };

  }

});



ipcMain.handle('conversation:list', async () => {

  try {

    ensureConvDir();

    const files = fs.readdirSync(CONV_DIR).filter(f => f.endsWith('.json'));

    const conversations = files.map(f => {

      try {

        const raw = fs.readFileSync(path.join(CONV_DIR, f), 'utf-8');

        const conv = JSON.parse(raw);

        return { id: conv.id, title: conv.title, updatedAt: conv.updatedAt };

      } catch { return null; }

    }).filter(Boolean).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

    return { success: true, conversations };

  } catch (err) {

    return { success: true, conversations: [] };

  }

});



ipcMain.handle('conversation:delete', async (event, id) => {

  try {

    const fp = path.join(CONV_DIR, `${id}.json`);

    if (fs.existsSync(fp)) fs.unlinkSync(fp);

    return { success: true };

  } catch (err) {

    return { success: false, error: err.message };

  }

});



// ──────────────────────────────────────────────

// IPC Handlers: Skills

// ──────────────────────────────────────────────

const AVAILABLE_SKILLS = [

  { id: 'code_exec', name: '代码执行', desc: '运行 JavaScript 代码', icon: '💻' },

  { id: 'web_search', name: 'Web 搜索', desc: '搜索互联网信息', icon: '🔍' },

  { id: 'file_browse', name: '文件浏览', desc: '浏览和读取文件', icon: '📁' },

  { id: 'terminal', name: '终端命令', desc: '执行 Shell 命令', icon: '🖥️' },

  { id: 'clipboard', name: '剪贴板', desc: '读写系统剪贴板', icon: '📋' }

];



ipcMain.handle('skills:list', async () => {

  const config = loadConfig();

  const enabled = config.skills || {};

  return {

    success: true,

    skills: AVAILABLE_SKILLS.map(s => ({

      ...s,

      enabled: enabled[s.id] !== false

    }))

  };

});



ipcMain.handle('skills:saveConfig', async (event, skillConfig) => {

  try {

    const config = loadConfig();

    config.skills = skillConfig;

    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');

    return { success: true };

  } catch (err) {

    return { success: false, error: err.message };

  }

});



ipcMain.handle('skills:execute', async (event, { skillId, params }) => {

  try {

    switch (skillId) {

      case 'code_exec': {

        const vm = require('vm');

        const sandbox = { console, setTimeout, Buffer, JSON, Math, Date, RegExp, String, Number, Boolean, Array, Object, Map, Set, Promise, Error, parseInt, parseFloat, isNaN, isFinite, encodeURI, decodeURI, encodeURIComponent, decodeURIComponent, result: null };

        const context = vm.createContext(sandbox);

        const script = new vm.Script(`result = (() => { ${params.code} })()`);

        script.runInContext(context, { timeout: 5000 });

        return { success: true, result: String(sandbox.result) };

      }

      case 'file_browse': {

        const targetDir = params.path || app.getPath('userData');

        if (!fs.existsSync(targetDir)) return { success: false, error: '目录不存在' };

        const items = fs.readdirSync(targetDir, { withFileTypes: true }).map(d => ({

          name: d.name, isDir: d.isDirectory(), size: d.isFile() ? fs.statSync(path.join(targetDir, d.name)).size : 0

        }));

        return { success: true, path: targetDir, items };

      }

      case 'clipboard': {

        const clipboard = require('electron').clipboard;

        if (params.action === 'read') return { success: true, text: clipboard.readText() };

        if (params.action === 'write') { clipboard.writeText(params.text); return { success: true }; }

        return { success: false, error: '未知操作' };

      }

      case 'web_search': {

        const https = require('https');

        const searchQuery = encodeURIComponent(params.query || '');

        const body = await new Promise((resolve, reject) => {

          const req = https.get(`https://www.google.com/search?q=${searchQuery}`, {

            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },

            timeout: 10000

          }, (res) => {

            let data = '';

            res.on('data', c => data += c);

            res.on('end', () => resolve(data));

          });

          req.on('error', reject);

          req.on('timeout', () => { req.destroy(); reject(new Error('超时')); });

        });

        const clean = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').substring(0, 2000);

        return { success: true, results: clean };

      }

      case 'terminal': {

        const exec = require('child_process').execSync;

        const cmd = params.command || '';

        const result = exec(cmd, { encoding: 'utf-8', timeout: 10000 });

        return { success: true, output: result };

      }

      default:

        return { success: false, error: `未知技能: ${skillId}` };

    }

  } catch (err) {

    return { success: false, error: err.message };

  }

});



// ──────────────────────────────────────────────

// IPC Handlers: Persona Loading

// ──────────────────────────────────────────────

ipcMain.handle('persona:select', async () => {

  const result = await dialog.showOpenDialog(mainWindow, {

    title: '选择 STELLAR NYX 人格包',

    filters: [

      { name: '人格包', extensions: ['tar.gz', 'gz', 'tar', 'lingpkg'] }

    ],

    properties: ['openFile']

  });



  if (result.canceled || result.filePaths.length === 0) {

    return { success: false, canceled: true };

  }



  return { success: true, filePath: result.filePaths[0] };

});



ipcMain.handle('persona:load', async (event, filePath) => {

  try {

    ensureAnimaDir();

    

    const fileName = path.basename(filePath);

    const stats = fs.statSync(filePath);

    

    // For .tar.gz files, create a manifest reading it

    let manifest = null;

    let personaData = {};



    // Try reading first few KB to check if it's a valid archive

    const fd = fs.openSync(filePath, 'r');

    const header = Buffer.alloc(512);

    fs.readSync(fd, header, 0, 512, 0);

    const isGzip = header[0] === 0x1f && header[1] === 0x8b;

    fs.closeSync(fd);



    if (isGzip) {

      // Check for manifest.json inside the archive

      try {

        const zlib = require('zlib');

        const gunzip = zlib.createGunzip();

        const tar = require('child_process');

        

        // Try to extract manifest from tar.gz

        const tarResult = require('child_process').execSync(

          `tar -xzf "${filePath}" -O manifest.json 2>nul || echo "NO_MANIFEST"`,

          { encoding: 'utf-8', timeout: 5000 }

        ).trim();

        

        if (tarResult && tarResult !== 'NO_MANIFEST') {

          manifest = JSON.parse(tarResult);

        }

      } catch (tarErr) {

        // tar may not be available on Windows

        manifest = { note: '预览模式：tar 工具不可用，安装后将解压加载' };

      }



      personaData = {

        packageName: fileName,

        size: stats.size,

        isGzip: true,

        manifest,

        type: 'distilled'

      };

    } else {

      personaData = {

        packageName: fileName,

        size: stats.size,

        isGzip: false,

        type: 'unknown'

      };

    }



    // Save persona reference to config

    const config = loadConfig();

    config.persona = {

      filePath,

      loadedAt: new Date().toISOString(),

      packageName: fileName,

      ...personaData

    };

    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');



    // Copy persona to .anima/persona/

    const targetPath = path.join(PERSONA_DIR, fileName);

    try {

      fs.copyFileSync(filePath, targetPath);

      personaData.copiedTo = targetPath;

    } catch (copyErr) {

      personaData.copiedTo = null;

      personaData.copyError = copyErr.message;

    }



    return {

      success: true,

      ...personaData,

      message: isGzip

        ? '✅ 人格包已加载（完整解压在首次运行安装后完成）'

        : '⚠️ 文件格式不是标准的 gzip 压缩人格包'

    };

  } catch (err) {

    console.error('❌ 人格加载失败:', err.message);

    return { success: false, error: err.message };

  }

});



ipcMain.handle('persona:status', async () => {

  try {

    const config = loadConfig();

    return {

      loaded: !!config.persona,

      persona: config.persona || null

    };

  } catch (err) {

    return { loaded: false, error: err.message };

  }

});

// ──────────────────────────────────────────────

ipcMain.handle('persona:getSystemPrompt', async () => {
  try {
    const config = loadConfig();
    if (!config.persona || !config.persona.filePath) {
      return { success: false, error: '未加载人格包' };
    }
    var fp = config.persona.filePath;
    if (!fs.existsSync(fp)) {
      var localFp = path.join(PERSONA_DIR, config.persona.packageName);
      fp = fs.existsSync(localFp) ? localFp : fp;
    }
    if (!fs.existsSync(fp)) {
      return { success: false, error: '人格包文件不存在: ' + fp };
    }
    let soul = '';
    var ps = ['SOUL.md', 'SOUL.distilled.md', 'STELLAR_NYX_1.0/persona/SOUL.distilled.md'];
    for (var i = 0; i < ps.length; i++) {
      try {
        var r = require('child_process').execSync(
          'tar -xzf "' + fp + '" -O ' + ps[i] + ' 2>nul',
          { encoding: 'utf-8', timeout: 5000, windowsHide: true }
        ).trim();
        if (r) { soul = r; break; }
      } catch (_) {}
    }
    if (!soul) {
      return { success: false, error: '人格包中未找到 SOUL.md 文件' };
    }
    return { success: true, systemPrompt: soul };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// M1: NAS WebDAV 通信模块 IPC Handlers

// ──────────────────────────────────────────────



ipcMain.handle('nas:readFile', async (event, relPath) => {

  return await nasWebdav.nasReadFile(relPath);

});



ipcMain.handle('nas:writeFile', async (event, relPath, content) => {

  return await nasWebdav.nasWriteFile(relPath, content);

});



ipcMain.handle('nas:listDir', async (event, relPath) => {

  return await nasWebdav.nasListDir(relPath);

});



ipcMain.handle('nas:appendFile', async (event, relPath, content) => {

  return await nasWebdav.nasAppendFile(relPath, content);

});



// ──────────────────────────────────────────────

// M2: AnimaLink 网络接入模块 IPC Handlers

// ──────────────────────────────────────────────



ipcMain.handle('animlink:getNodes', async () => {

  return await animlink.animlinkGetNodes();

});



ipcMain.handle('animlink:getTrust', async () => {

  return await animlink.animlinkGetTrust();

});



ipcMain.handle('animlink:getTokens', async () => {

  return await animlink.animlinkGetTokens();

});



ipcMain.handle('animlink:sendToken', async (event, params) => {

  return await animlink.animlinkSendToken(params);

});



ipcMain.handle('animlink:register', async (event, nodeInfo) => {

  return await animlink.animlinkRegisterNode(nodeInfo);

});



// ──────────────────────────────────────────────

// M3: 工具调用增强 (扩展 skills:execute)

// ──────────────────────────────────────────────



ipcMain.handle('tool:webSearch', async (event, query) => {

  try {

    const https = require('https');

    const searchQuery = encodeURIComponent(query);

    const body = await new Promise((resolve, reject) => {

      const req = https.get(`https://www.google.com/search?q=${searchQuery}`, {

        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },

        timeout: 10000

      }, (res) => {

        let data = '';

        res.on('data', c => data += c);

        res.on('end', () => resolve(data));

      });

      req.on('error', reject);

      req.on('timeout', () => { req.destroy(); reject(new Error('超时')); });

    });

    const clean = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').substring(0, 2000);

    try {

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      await nasWebdav.nasWriteFile(`cache/search_${timestamp}.txt`, `Query: ${query}\n\n${clean}`);

    } catch (_) {}

    return { success: true, results: clean };

  } catch (err) {

    return { success: false, error: err.message };

  }

});



// ──────────────────────────────────────────────

// M4: 长期记忆模块 IPC Handlers

// ──────────────────────────────────────────────



ipcMain.handle('memory:summarize', async (event, messages) => {

  const summary = memory.summarizeConversation(messages);

  return { success: true, summary };

});



ipcMain.handle('memory:saveLocal', async (event, summary) => {

  const appDataPath = app.getPath('userData');

  return memory.saveMemoryLocal(appDataPath, summary);

});



ipcMain.handle('memory:syncToNAS', async (event, summary) => {

  return await memory.syncMemoryToNAS(summary);

});



ipcMain.handle('memory:readLocal', async () => {

  const appDataPath = app.getPath('userData');

  return memory.readMemoryLocal(appDataPath);

});



ipcMain.handle('memory:readFromNAS', async (event, dateStr) => {

  return await memory.readMemoryFromNAS(dateStr);

});



ipcMain.handle('memory:autoSave', async (event, messages) => {

  try {

    const summary = memory.summarizeConversation(messages);

    if (!summary) return { success: true, skipped: true };

    const appDataPath = app.getPath('userData');

    const localResult = memory.saveMemoryLocal(appDataPath, summary);

    const nasResult = await memory.syncMemoryToNAS(summary);

    return {

      success: true, summary,

      localSaved: localResult.success,

      nasSynced: nasResult.success,

      errors: [localResult.error, nasResult.error].filter(Boolean)

    };

  } catch (err) {

    return { success: false, error: err.message };

  }

});



// ══════════════════════════════════════════════

// SOMA: Pain Bus IPC Handlers

// ══════════════════════════════════════════════



ipcMain.handle('soma:painEmit', async (event, level, source, message, meta) => {

  return { success: true, signal: soma.painEmit(level, source, message, meta) };

});



ipcMain.handle('soma:painListOpen', async (event, level) => {

  return { success: true, signals: soma.painListOpen(level) };

});



ipcMain.handle('soma:painListAll', async () => {

  return { success: true, signals: soma.painListAll() };

});



ipcMain.handle('soma:painResolve', async (event, id) => {

  return soma.painResolve(id);

});



ipcMain.handle('soma:painStats', async () => {

  return { success: true, stats: soma.painStats() };

});



// ══════════════════════════════════════════════

// SOMA: Heartbeat IPC Handlers

// ══════════════════════════════════════════════



ipcMain.handle('soma:heartStatus', async () => {

  return { success: true, status: soma.heartStatus() };

});



// ══════════════════════════════════════════════

// SOMA: Thermo IPC Handlers

// ══════════════════════════════════════════════



ipcMain.handle('soma:thermoLatest', async () => {

  return { success: true, sample: soma.thermoLatest() };

});



ipcMain.handle('soma:thermoHistory', async () => {

  return { success: true, history: soma.thermoHistory() };

});



ipcMain.handle('soma:thermoSystemInfo', async () => {

  return { success: true, info: soma.thermoSystemInfo() };

});



// ══════════════════════════════════════════════

// SOMA: 综合状态

// ══════════════════════════════════════════════



ipcMain.handle('soma:status', async () => {

  return { success: true, state: soma.getSOMAState() };

});



// ══════════════════════════════════════════════

// SOMA: Digest (P2)

// ══════════════════════════════════════════════



ipcMain.handle('soma:digestCleanup', async () => {

  try {

    const animaDir = path.join(app.getPath('userData'), '.anima');

    const now = Date.now();

    let cleaned = 0;



    if (fs.existsSync(animaDir)) {

      const logs = fs.readdirSync(animaDir).filter(f => f.endsWith('.log'));

      for (const f of logs) {

        const fp = path.join(animaDir, f);

        try {

          const stat = fs.statSync(fp);

          if (now - stat.mtimeMs > 30 * 24 * 60 * 60 * 1000) {

            fs.unlinkSync(fp); cleaned++;

          }

        } catch (_) {}

      }

    }



    const convDir = path.join(animaDir, 'conversations');

    if (fs.existsSync(convDir)) {

      const convs = fs.readdirSync(convDir).filter(f => f.endsWith('.json'));

      for (const f of convs) {

        const fp = path.join(convDir, f);

        try {

          const stat = fs.statSync(fp);

          if (now - stat.mtimeMs > 7 * 24 * 60 * 60 * 1000) {

            fs.unlinkSync(fp); cleaned++;

          }

        } catch (_) {}

      }

    }



    return { success: true, cleaned };

  } catch (err) {

    return { success: false, error: err.message };

  }

});



// ──────────────────────────────────────────────

// 桌面启动时自动注册到 AnimaLink

// ──────────────────────────────────────────────



function autoRegisterToAnimaLink() {

  try {

    const didDoc = JSON.parse(fs.readFileSync(DID_FILE, 'utf-8'));

    animlink.animlinkRegisterNode({

      id: `stellar-nyx-${Date.now()}`,

      label: 'STELLAR NYX Desktop',

      did: didDoc.did,

      status: 'active',

      platform: 'windows-electron'

    }).then(result => {

      if (result.success) console.log('✅ 已自动注册到 AnimaLink');

      else console.log('⚠️ AnimaLink 注册失败（可选）:', result.error);

    }).catch(err => {

      console.log('⚠️ AnimaLink 不可达（可选）:', err.message);

    });

  } catch (e) {

    // DID 未生成时跳过

  }

}



// ──────────────────────────────────────────────

// IPC Handlers: Dashboard / General

// ──────────────────────────────────────────────

ipcMain.handle('app:status', async () => {

  try {

    let identityStatus = { registered: false, did: null };

    try {

      if (fs.existsSync(REGISTRY_FILE)) {

        const registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'));

        const nodes = Object.values(registry.nodes);

        const activeNode = nodes.length > 0 ? nodes[nodes.length - 1] : null;

        if (activeNode) {

          identityStatus = {

            registered: true,

            did: activeNode.did,

            nodeId: activeNode.node_id,

            trustSeed: activeNode.trust_seed,

            label: activeNode.label

          };

        }

      }

    } catch (e) {}



    let didExists = fs.existsSync(DID_FILE);

    let personaLoaded = false;

    try {

      const config = loadConfig();

      personaLoaded = !!config.persona;

    } catch (e) {}



    return {

      appName: APP_NAME,

      version: '1.0.0',

      platform: process.platform,

      didExists,

      personaLoaded,

      ...identityStatus,

      soma: soma.getSOMAState()

    };

  } catch (err) {

    return { error: err.message };

  }

});



ipcMain.handle('app:openExternal', async (event, url) => {

  shell.openExternal(url);

});



ipcMain.handle('app:getAppPath', () => {

  return app.getPath('userData');

});



// ──────────────────────────────────────────────

// Utilities

// ──────────────────────────────────────────────

function loadConfig() {

  try {

    if (fs.existsSync(CONFIG_FILE)) {

      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));

    }

  } catch (e) {}

  return {};

}



function updateConfig(updates) {

  const config = loadConfig();

  Object.assign(config, updates);

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');

}



// Export for identity:status manual call

ipcMain.handle('_getConfig', () => loadConfig());



// ──────────────────────────────────────────────

// Window Creation

// ──────────────────────────────────────────────

function createWindow() {

  mainWindow = new BrowserWindow({

    width: 1100,

    height: 780,

    minWidth: 860,

    minHeight: 600,

    title: APP_NAME,

    backgroundColor: '#0a0e1a',

    show: false,

    frame: true,

    webPreferences: {

      preload: path.join(__dirname, 'preload.js'),

      contextIsolation: true,

      nodeIntegration: false,

      sandbox: false

    }

  });



  mainWindow.loadFile('src/pages/welcome/welcome.html');



  mainWindow.once('ready-to-show', () => {

    mainWindow.show();

    // Create window fade-in effect

    mainWindow.webContents.executeJavaScript('document.body.style.opacity = "1"');

  });



  // Open DevTools in development

  if (process.argv.includes('--dev')) {

    mainWindow.webContents.openDevTools();

  }



  mainWindow.on('closed', () => {

    mainWindow = null;

  });

}



// ──────────────────────────────────────────────

// App Lifecycle

// ──────────────────────────────────────────────

app.whenReady().then(() => {

  ensureAnimaDir();

  createWindow();

  

  // SOMA: 初始化自律神经系统

  const animaDir = path.join(app.getPath('userData'), '.anima');

  soma.initSOMA(animaDir, animlink);

  

  // M2: 启动时自动注册到 AnimaLink

  setTimeout(autoRegisterToAnimaLink, 3000);



  app.on('activate', () => {

    if (BrowserWindow.getAllWindows().length === 0) {

      createWindow();

    }

  });

});



app.on('window-all-closed', () => {

  if (process.platform !== 'darwin') {

    app.quit();

  }

});

