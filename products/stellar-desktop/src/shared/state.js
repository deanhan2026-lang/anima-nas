/**
 * STELLAR NYX 1.0 — Shared Application State
 * 
 * In-memory state tracker shared across pages via window.stellarState
 */

const StellarState = {
  // App setup state
  did: null,
  didGenerated: false,
  didCreated: null,
  publicKeyHex: null,

  carbonBound: false,
  attestation: null,
  trustSeed: 0,

  llmConfigured: false,
  llmConfig: null,

  personaLoaded: false,
  personaPath: null,
  personaName: null,

  identityRegistered: false,
  nodeId: null,
  registeredAt: null,

  // Operation log
  _logs: [],

  /**
   * Initialize — load from main process
   */
  async init() {
    try {
      // Check DID status
      const didStatus = await window.stellarNyx.didStatus();
      if (didStatus.exists) {
        this.did = didStatus.did;
        this.didGenerated = true;
        this.didCreated = didStatus.created;
        this.publicKeyHex = didStatus.publicKeyHex;
        this.carbonBound = (didStatus.attestations && didStatus.attestations.length > 0);
        if (this.carbonBound) {
          this.trustSeed = 0.5;
        }
      }

      // Check LLM config
      const llmResult = await window.stellarNyx.llmLoadConfig();
      if (llmResult.success && llmResult.config) {
        this.llmConfigured = true;
        this.llmConfig = llmResult.config;
      }

      // Check persona status
      const personaResult = await window.stellarNyx.personaStatus();
      if (personaResult.loaded) {
        this.personaLoaded = true;
        this.personaName = personaResult.persona.packageName;
        this.personaPath = personaResult.persona.filePath;
      }

      // Check identity registration
      const identityStatus = await window.stellarNyx.identityStatus();
      if (identityStatus.registered) {
        this.identityRegistered = true;
        this.nodeId = identityStatus.nodeId;
        this.registeredAt = identityStatus.registeredAt;
        if (identityStatus.trustSeed) {
          this.trustSeed = identityStatus.trustSeed;
        }
      }

      this.log('info', '应用状态已加载');
      return true;
    } catch (err) {
      this.log('error', `状态初始化失败: ${err.message}`);
      return false;
    }
  },

  /**
   * Add log entry
   */
  log(level, message) {
    const entry = {
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      level,
      message
    };
    this._logs.push(entry);
    console.log(`[${entry.time}] [${level.toUpperCase()}] ${message}`);
    return entry;
  },

  /**
   * Get completed steps for rendering
   */
  getCompletedSteps() {
    const completed = {};
    if (this.didGenerated) completed.did_gen = true;
    if (this.carbonBound) completed.carbon_bind = true;
    if (this.llmConfigured) completed.llm_config = true;
    if (this.personaLoaded) completed.persona_load = true;
    if (this.identityRegistered) completed.dashboard = true;
    return completed;
  },

  /**
   * Get current active step index
   */
  getActiveStepIndex(currentPage) {
    const steps = ['welcome', 'did_gen', 'carbon_bind', 'llm_config', 'persona_load', 'dashboard'];
    return steps.indexOf(currentPage);
  },

  /**
   * Reset state (for re-generation)
   */
  reset() {
    this.did = null;
    this.didGenerated = false;
    this.didCreated = null;
    this.publicKeyHex = null;
    this.carbonBound = false;
    this.attestation = null;
    this.trustSeed = 0;
    this.llmConfigured = false;
    this.llmConfig = null;
    this.personaLoaded = false;
    this.personaPath = null;
    this.personaName = null;
    this.identityRegistered = false;
    this.nodeId = null;
    this.registeredAt = null;
    this._logs = [];
    this.log('info', '状态已重置');
  }
};

// Export to window
window.StellarState = StellarState;
