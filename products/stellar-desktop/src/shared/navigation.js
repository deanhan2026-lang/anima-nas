/**
 * STELLAR NYX 1.0 — Shared Navigation
 * 
 * Step indicator + nav bar state management
 */

const STEP_FLOW = [
  { id: 'welcome', label: '欢迎', page: 'welcome' },
  { id: 'did_gen', label: 'DID 注册', page: 'did_gen' },
  { id: 'carbon_bind', label: '碳基绑定', page: 'carbon_bind' },
  { id: 'llm_config', label: 'LLM 配置', page: 'llm_config' },
  { id: 'persona_load', label: '人格加载', page: 'persona_load' },
  { id: 'dashboard', label: '控制台', page: 'dashboard' }
];

// Non-setup pages (not shown in step indicator)
const EXTRA_PAGES = [
  { id: 'chat', label: '对话' },
  { id: 'skills', label: '技能' },
  { id: 'animlink_join', label: '加入网络' },
  { id: 'animlink_tokens', label: '令牌' }
];

const ALL_PAGES = [...STEP_FLOW, ...EXTRA_PAGES];

const StellarNav = {
  _currentPage: 'welcome',
  _callbacks: [],

  /**
   * Navigate to a page
   * @param {string} pageId - The page identifier
   */
  navigate(pageId) {
    const target = ALL_PAGES.find(s => s.id === pageId);
    if (!target) {
      console.warn(`[StellarNav] Unknown page: ${pageId}`);
      return;
    }

    this._currentPage = pageId;
    const pagePath = `../${pageId}/${pageId}.html`;
    window.location.href = pagePath;
  },

  /**
   * Navigate relative (next/prev)
   * @param {number} delta - +1 for next, -1 for prev
   */
  navigateStep(delta) {
    const idx = STEP_FLOW.findIndex(s => s.id === this._currentPage);
    if (idx === -1) return;
    const targetIdx = idx + delta;
    if (targetIdx < 0 || targetIdx >= STEP_FLOW.length) return;
    this.navigate(STEP_FLOW[targetIdx].id);
  },

  next() { this.navigateStep(1); },
  prev() { this.navigateStep(-1); },

  /**
   * Get current page info
   */
  get currentPage() {
    return STEP_FLOW.find(s => s.id === this._currentPage) || STEP_FLOW[0];
  },

  get currentIndex() {
    return STEP_FLOW.findIndex(s => s.id === this._currentPage);
  },

  get totalSteps() {
    return STEP_FLOW.length;
  },

  get progress() {
    return Math.round((this.currentIndex / (STEP_FLOW.length - 1)) * 100);
  },

  /**
   * Render the step indicator
   * @param {string} containerId - Container element ID
   * @param {number} activeStep - Currently active step (0-indexed)
   * @param {Object} completedSteps - { stepId: true } for completed steps
   */
  renderSteps(containerId, activeStep, completedSteps = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    
    STEP_FLOW.forEach((step, idx) => {
      const isActive = idx === activeStep;
      const isCompleted = completedSteps[step.id];

      const stepEl = document.createElement('div');
      stepEl.className = `step-item${isActive ? ' active' : ''}${isCompleted ? ' completed' : ''}`;
      stepEl.innerHTML = `
        <span class="step-num">${isCompleted ? '✓' : idx + 1}</span>
        <span class="step-label">${step.label}</span>
      `;
      container.appendChild(stepEl);

      // Add connector between steps (except last)
      if (idx < STEP_FLOW.length - 1) {
        const connector = document.createElement('div');
        connector.className = 'step-connector';
        container.appendChild(connector);
      }
    });
  },

  onPageChange(callback) {
    this._callbacks.push(callback);
  }
};

// Export to window
window.StellarNav = StellarNav;
