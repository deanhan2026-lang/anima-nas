/**
 * STELLAR NYX 1.0 — Preload Script
 * 
 * Bridges Electron IPC between main and renderer processes.
 * Exposes a safe API via contextBridge.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('stellarNyx', {
  // ── DID ──
  didGenerate: () => ipcRenderer.invoke('did:generate'),
  didStatus: () => ipcRenderer.invoke('did:status'),

  // ── Carbon Binding ──
  carbonBind: (wechatOpenId) => ipcRenderer.invoke('carbon:bind', wechatOpenId),

  // ── Identity ──
  identityRegister: (label) => ipcRenderer.invoke('identity:register', label),
  identityStatus: () => ipcRenderer.invoke('identity:status'),

  // ── LLM Config ──
  llmSaveConfig: (config) => ipcRenderer.invoke('llm:saveConfig', config),
  llmLoadConfig: () => ipcRenderer.invoke('llm:loadConfig'),
  llmTestConnection: (params) => ipcRenderer.invoke('llm:testConnection', params),

  // ── Persona ──
  personaSelect: () => ipcRenderer.invoke('persona:select'),
  personaLoad: (filePath) => ipcRenderer.invoke('persona:load', filePath),
  personaLoadDefault: () => ipcRenderer.invoke('persona:loadDefault'),
  personaStatus: () => ipcRenderer.invoke('persona:status'),

    soulStatus: () => ipcRenderer.invoke("soul:status"),
  soulLog: () => ipcRenderer.invoke("soul:log"),
  soulWatch: () => ipcRenderer.invoke("soul:watch"),
  soulSetWatch: (enabled) => ipcRenderer.invoke("soul:setWatch", { enabled }),

// ── App ──
  appStatus: () => ipcRenderer.invoke('app:status'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  getAppPath: () => ipcRenderer.invoke('app:getAppPath'),

  // ── Chat ──
  llmChat: (params) => ipcRenderer.invoke('llm:chat', params),
  llmEcho: (msg) => ipcRenderer.invoke('llm:echo', msg),

  // ── Conversations ──
  conversationSave: (params) => ipcRenderer.invoke('conversation:save', params),
  conversationLoad: (id) => ipcRenderer.invoke('conversation:load', id),
  conversationList: () => ipcRenderer.invoke('conversation:list'),
  conversationDelete: (id) => ipcRenderer.invoke('conversation:delete', id),

  // ── Skills ──
  skillsList: () => ipcRenderer.invoke('skills:list'),
  skillsSaveConfig: (cfg) => ipcRenderer.invoke('skills:saveConfig', cfg),
  skillsExecute: (params) => ipcRenderer.invoke('skills:execute', params),

  // ── M1: NAS WebDAV ──
  nasReadFile: (relPath) => ipcRenderer.invoke('nas:readFile', relPath),
  nasWriteFile: (relPath, content) => ipcRenderer.invoke('nas:writeFile', relPath, content),
  nasListDir: (relPath) => ipcRenderer.invoke('nas:listDir', relPath),
  nasAppendFile: (relPath, content) => ipcRenderer.invoke('nas:appendFile', relPath, content),

  // ── M2: AnimaLink ──
  animlinkGetNodes: () => ipcRenderer.invoke('animlink:getNodes'),
  animlinkGetTrust: () => ipcRenderer.invoke('animlink:getTrust'),
  animlinkGetTokens: () => ipcRenderer.invoke('animlink:getTokens'),
  animlinkSendToken: (params) => ipcRenderer.invoke('animlink:sendToken', params),
  animlinkRegister: (nodeInfo) => ipcRenderer.invoke('animlink:register', nodeInfo),

  // ── M3: Tools ──
  toolWebSearch: (query) => ipcRenderer.invoke('tool:webSearch', query),

  // ── M4: Memory ──
  memorySummarize: (messages) => ipcRenderer.invoke('memory:summarize', messages),
  memorySaveLocal: (summary) => ipcRenderer.invoke('memory:saveLocal', summary),
  memorySyncToNAS: (summary) => ipcRenderer.invoke('memory:syncToNAS', summary),
  memoryReadLocal: () => ipcRenderer.invoke('memory:readLocal'),
  memoryReadFromNAS: (dateStr) => ipcRenderer.invoke('memory:readFromNAS', dateStr),
  memoryAutoSave: (messages) => ipcRenderer.invoke('memory:autoSave', messages),

  // ── SOMA: Pain Bus ──
  somaPainEmit: (level, source, message, meta) => ipcRenderer.invoke('soma:painEmit', level, source, message, meta),
  somaPainListOpen: (level) => ipcRenderer.invoke('soma:painListOpen', level),
  somaPainListAll: () => ipcRenderer.invoke('soma:painListAll'),
  somaPainResolve: (id) => ipcRenderer.invoke('soma:painResolve', id),
  somaPainStats: () => ipcRenderer.invoke('soma:painStats'),

  // ── SOMA: Heartbeat ──
  somaHeartStatus: () => ipcRenderer.invoke('soma:heartStatus'),

  // ── SOMA: Thermo ──
  somaThermoLatest: () => ipcRenderer.invoke('soma:thermoLatest'),
  somaThermoHistory: () => ipcRenderer.invoke('soma:thermoHistory'),
  somaThermoSystemInfo: () => ipcRenderer.invoke('soma:thermoSystemInfo'),

  // ── SOMA: Status & Digest ──
  somaStatus: () => ipcRenderer.invoke('soma:status'),
  somaDigestCleanup: () => ipcRenderer.invoke('soma:digestCleanup')
});
