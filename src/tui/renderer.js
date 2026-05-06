import { loadConfig, setChecks } from '../config/storage.js';

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m'
};

export class TUI {
  constructor() {
    this.config = loadConfig();
  }

  clear() {
    console.clear();
  }

  // Component: KeyHint - [K] Label
  renderKeyHint(key, label) {
    return `${COLORS.bold}[${key}]${COLORS.reset} ${label}`;
  }

  // Component: Footer - row of key hints
  renderFooter(hints) {
    const footerLine = hints.map(hint => this.renderKeyHint(hint.key, hint.label)).join('  ');
    console.log(`\n${footerLine}`);
  }

  // Component: Header
  renderHeader(title) {
    const width = 50;
    const padding = Math.floor((width - title.length) / 2);
    console.log(`\n${COLORS.cyan}┌${'─'.repeat(width)}┐${COLORS.reset}`);
    console.log(`${COLORS.cyan}│${' '.repeat(padding)}${title}${' '.repeat(width - padding - title.length)}│${COLORS.reset}`);
    console.log(`${COLORS.cyan}└${'─'.repeat(width)}┘${COLORS.reset}\n`);
  }

  // Screen: Main Menu
  renderMainMenu() {
    this.clear();
    this.renderHeader('NEXUS');

    console.log(`📋 ${COLORS.bold}Main Menu${COLORS.reset}\n`);
    console.log('  Run Code Analysis');
    console.log('  Set API Key');
    console.log('  Select Checks');
    console.log('  Choose Model');
    console.log('  View Configuration');
    console.log('  Exit\n');

    this.renderFooter([
      { key: 'R', label: 'Run' },
      { key: 'K', label: 'API Key' },
      { key: 'C', label: 'Checks' },
      { key: 'M', label: 'Model' },
      { key: 'V', label: 'Config' },
      { key: 'Q', label: 'Quit' }
    ]);
  }

  // Screen: API Key Setup
  renderSetApiKey() {
    this.clear();
    this.renderHeader('SET API KEY');

    console.log('🔑 Enter your ANTHROPIC_API_KEY:');
    console.log('(input will be hidden)\n');
  }

  // Screen: Model Selection
  renderSelectModel() {
    this.clear();
    this.renderHeader('SELECT MODEL');

    console.log('🤖 Choose Claude Model:\n');
    console.log(`  ${this.renderKeyHint('1', 'Opus - Most capable')}`);
    console.log(`  ${this.renderKeyHint('2', 'Sonnet - Balanced')}`);
    console.log(`  ${this.renderKeyHint('3', 'Haiku - Fastest')}\n`);

    const current = this.config.model;
    if (current.includes('opus')) console.log(`  ${COLORS.green}✓${COLORS.reset} Currently: Opus`);
    else if (current.includes('sonnet')) console.log(`  ${COLORS.green}✓${COLORS.reset} Currently: Sonnet`);
    else console.log(`  ${COLORS.green}✓${COLORS.reset} Currently: Haiku`);
    console.log();

    this.renderFooter([
      { key: '1', label: 'Opus' },
      { key: '2', label: 'Sonnet' },
      { key: '3', label: 'Haiku' },
      { key: 'Q', label: 'Back' }
    ]);
  }

  // Screen: Checks Selection
  renderSelectChecks() {
    this.clear();
    this.renderHeader('SELECT CHECKS');

    console.log('✅ Analysis Checks:\n');

    const checks = [
      { key: '1', emoji: '🔐', name: 'security' },
      { key: '2', emoji: '⚡', name: 'performance' },
      { key: '3', emoji: '🏗️', name: 'architecture' },
      { key: '4', emoji: '✅', name: 'quality' },
      { key: '5', emoji: '✔️', name: 'testing' },
      { key: '6', emoji: '🔍', name: 'lint' },
      { key: '7', emoji: '📘', name: 'types' }
    ];

    checks.forEach(check => {
      const enabled = this.config.checks[check.name];
      const status = enabled ? `${COLORS.green}✓${COLORS.reset}` : `${COLORS.dim}✗${COLORS.reset}`;
      const label = `${check.emoji} ${check.name.padEnd(12)}`;
      console.log(`  ${this.renderKeyHint(check.key, label)} ${status}`);
    });

    console.log();
    this.renderFooter([
      { key: '1-7', label: 'Toggle' },
      { key: 'Q', label: 'Back' }
    ]);
  }

  // Screen: Config View
  renderViewConfig() {
    this.clear();
    this.renderHeader('CONFIGURATION');

    console.log(`${COLORS.bold}Current Settings:${COLORS.reset}\n`);
    console.log(`  Model:  ${COLORS.cyan}${this.config.model}${COLORS.reset}`);
    console.log(`  API:    ${this.config.apiKey ? `${COLORS.green}✓ Set${COLORS.reset}` : `${COLORS.red}✗ Not set${COLORS.reset}`}\n`);

    console.log(`${COLORS.bold}Active Checks:${COLORS.reset}\n`);
    Object.entries(this.config.checks).forEach(([name, enabled]) => {
      const emoji = {
        security: '🔐',
        performance: '⚡',
        architecture: '🏗️',
        quality: '✅',
        testing: '✔️',
        lint: '🔍',
        types: '📘'
      }[name];
      const status = enabled ? `${COLORS.green}✓${COLORS.reset}` : `${COLORS.dim}✗${COLORS.reset}`;
      console.log(`  ${emoji} ${name.padEnd(12)} ${status}`);
    });

    console.log();
    this.renderFooter([{ key: 'Q', label: 'Back' }]);
  }

  // Screen: Analysis Running
  renderAnalysisHeader() {
    this.clear();
    this.renderHeader('CODE REVIEW ANALYSIS');
    console.log(`Project:  ${process.cwd()}`);
    console.log(`Model:    ${COLORS.cyan}${this.config.model}${COLORS.reset}\n`);
  }

  // Component: Input (hidden)
  async getHiddenInput(prompt) {
    return new Promise(resolve => {
      process.stdout.write(prompt);

      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }

      let input = '';
      const onData = data => {
        const char = data.toString();

        if (char === '\x03') { // Ctrl+C
          process.stdout.write('\n');
          process.exit();
        }

        if (char === '\r' || char === '\n') {
          process.stdout.write('\n');
          process.stdin.removeListener('data', onData);
          if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
          }
          resolve(input);
        } else if (char === '\x7f') { // Backspace
          input = input.slice(0, -1);
          process.stdout.write('\b \b');
        } else {
          input += char;
          process.stdout.write('*');
        }
      };

      process.stdin.on('data', onData);
    });
  }

  // Component: Key Press
  async getKeyPress() {
    return new Promise(resolve => {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }

      const onData = data => {
        const key = data.toString().toLowerCase();
        process.stdin.removeListener('data', onData);
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        resolve(key);
      };

      process.stdin.on('data', onData);
    });
  }

  // Actions
  setApiKey(key) {
    setApiKey(key);
    this.config = loadConfig();
  }

  setModel(model) {
    setModel(model);
    this.config = loadConfig();
  }

  toggleCheck(checkName) {
    this.config.checks[checkName] = !this.config.checks[checkName];
    setChecks(this.config.checks);
  }

  async editApiKey(provider) {
    const { setApiKey } = await import('./storage.js');
    this.clear();
    this.renderHeader(`SET ${provider.toUpperCase()} API KEY`);
    console.log(`Enter your ${provider.toUpperCase()} API key:`);
    console.log('(input will be hidden)\n');
    const apiKey = await this.getHiddenInput('  > ');
    if (apiKey) {
      setApiKey(provider, apiKey);
      console.log('\n✅ API key saved');
    }
    return apiKey;
  }
}
