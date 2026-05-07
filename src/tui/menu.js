const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  bgCyan: '\x1b[46m',
  bgBlack: '\x1b[40m'
};

const NEXUS_LOGO = `${COLORS.cyan}${COLORS.bold}
███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝${COLORS.reset}`;

export class Menu {
  constructor(items, options = {}) {
    this.items = items;
    this.selectedIndex = 0;
    this.version = options.version || '';
    this.tagline = options.tagline || 'AI-Powered Code Review';
  }

  render() {
    console.clear();
    this.renderHeader();
    this.renderItems();
    this.renderFooter();
  }

  renderHeader() {
    console.log(NEXUS_LOGO);
    const versionLine = this.version ? `${COLORS.dim}v${this.version}${COLORS.reset}` : '';
    const tagline = `${COLORS.cyan}${this.tagline}${COLORS.reset}`;
    if (this.version) {
      console.log(`                                            ${versionLine}`);
    }
    console.log(`            ${tagline}`);
    console.log();
    console.log(`${COLORS.dim}${'─'.repeat(60)}${COLORS.reset}`);
    console.log();
  }

  renderItems() {
    this.items.forEach((item, index) => {
      const isSelected = index === this.selectedIndex;
      const prefix = isSelected
        ? `${COLORS.cyan}${COLORS.bold} ▶ ${COLORS.reset}`
        : `   `;
      const label = isSelected
        ? `${COLORS.cyan}${COLORS.bold}${item.label}${COLORS.reset}`
        : `${COLORS.bold}${item.label}${COLORS.reset}`;

      console.log(`${prefix}${label}`);
      if (item.sublabel) {
        console.log(`     ${COLORS.dim}${item.sublabel}${COLORS.reset}`);
      }
      console.log();
    });
  }

  renderFooter() {
    console.log(`${COLORS.dim}${'─'.repeat(60)}${COLORS.reset}`);
    const footer = `${COLORS.bold}[↑↓]${COLORS.reset} Navigate  ${COLORS.bold}[Enter]${COLORS.reset} Select  ${COLORS.bold}[Q]${COLORS.reset} Quit`;
    console.log(footer);
  }

  async select() {
    return new Promise(resolve => {
      this.render();

      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }

      const onData = data => {
        const key = data.toString();

        if (key === '\x1b[A') { // Up arrow
          this.selectedIndex = (this.selectedIndex - 1 + this.items.length) % this.items.length;
          this.render();
        } else if (key === '\x1b[B') { // Down arrow
          this.selectedIndex = (this.selectedIndex + 1) % this.items.length;
          this.render();
        } else if (key === '\r' || key === '\n') { // Enter
          process.stdin.removeListener('data', onData);
          if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
          }
          resolve(this.items[this.selectedIndex]);
        } else if (key === 'q' || key === 'Q' || key === '\x03') { // Q or Ctrl+C
          process.stdin.removeListener('data', onData);
          if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
          }
          const quitItem = this.items.find(i => i.key === 'quit');
          if (quitItem) resolve(quitItem);
          else process.exit(0);
        }
      };

      process.stdin.on('data', onData);
    });
  }
}

const SEV_COLORS = {
  critical: COLORS.magenta,
  high: COLORS.red,
  error: COLORS.red,
  medium: COLORS.yellow,
  warning: COLORS.yellow,
  low: COLORS.dim,
  info: COLORS.dim
};

const SEV_RANK = { critical: 0, high: 1, error: 1, medium: 2, warning: 2, low: 3, info: 4 };

function termWidth() {
  return Math.max(60, Math.min(process.stdout.columns || 80, 140));
}

function truncate(str, max) {
  if (str.length <= max) return str.padEnd(max);
  return str.slice(0, max - 1) + '…';
}

function truncatePath(path, max) {
  if (path.length <= max) return path;
  return '…' + path.slice(-(max - 1));
}

function wrap(text, width, indent = '  ') {
  const out = [];
  const words = String(text).split(/\s+/);
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > width) {
      out.push(indent + line.trim());
      line = w;
    } else {
      line += ' ' + w;
    }
  }
  if (line.trim()) out.push(indent + line.trim());
  return out.join('\n');
}

export class ResultsMenu {
  constructor(findings) {
    this.findings = [...findings].sort((a, b) => {
      const ra = SEV_RANK[(a.severity || 'medium').toLowerCase()] ?? 99;
      const rb = SEV_RANK[(b.severity || 'medium').toLowerCase()] ?? 99;
      if (ra !== rb) return ra - rb;
      return (a.file || '').localeCompare(b.file || '');
    });
    this.selectedIndices = new Set();
    this.selectedIndex = 0;
    this.scrollOffset = 0;
    this.pageSize = 10;
  }

  ensureVisible() {
    if (this.selectedIndex < this.scrollOffset) {
      this.scrollOffset = this.selectedIndex;
    } else if (this.selectedIndex >= this.scrollOffset + this.pageSize) {
      this.scrollOffset = this.selectedIndex - this.pageSize + 1;
    }
  }

  render() {
    console.clear();
    this.renderHeader();
    this.renderFindings();
    this.renderDetail();
    this.renderFooter();
  }

  renderHeader() {
    const w = termWidth();
    const counts = this.findings.reduce((acc, f) => {
      const s = (f.severity || 'medium').toLowerCase();
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});
    const parts = [];
    if (counts.critical) parts.push(`${COLORS.magenta}${counts.critical} critical${COLORS.reset}`);
    if (counts.high) parts.push(`${COLORS.red}${counts.high} high${COLORS.reset}`);
    if (counts.medium || counts.warning) parts.push(`${COLORS.yellow}${(counts.medium || 0) + (counts.warning || 0)} medium${COLORS.reset}`);
    if (counts.low || counts.info) parts.push(`${COLORS.dim}${(counts.low || 0) + (counts.info || 0)} low${COLORS.reset}`);

    console.log(`\n${COLORS.cyan}${COLORS.bold}Code Review Results${COLORS.reset}`);
    console.log(`${COLORS.dim}${'─'.repeat(w)}${COLORS.reset}`);
    const summary = `${COLORS.bold}${this.findings.length}${COLORS.reset} findings  ·  ${parts.join('  ·  ')}  ·  ${COLORS.cyan}${this.selectedIndices.size} selected${COLORS.reset}`;
    console.log(summary);
    console.log();
  }

  renderFindings() {
    const w = termWidth();
    const total = this.findings.length;
    const start = this.scrollOffset;
    const end = Math.min(start + this.pageSize, total);

    if (start > 0) {
      console.log(`  ${COLORS.dim}↑ ${start} more above${COLORS.reset}`);
    } else {
      console.log();
    }

    for (let i = start; i < end; i++) {
      const f = this.findings[i];
      const isSelected = i === this.selectedIndex;
      const isChecked = this.selectedIndices.has(i);

      const sev = (f.severity || 'medium').toLowerCase();
      const sevColor = SEV_COLORS[sev] || COLORS.dim;
      const sevTag = `${sevColor}${truncate(sev.toUpperCase(), 8)}${COLORS.reset}`;

      const checkbox = isChecked ? `${COLORS.green}✓${COLORS.reset}` : `${COLORS.dim}·${COLORS.reset}`;
      const cursor = isSelected ? `${COLORS.cyan}${COLORS.bold}▶${COLORS.reset}` : ' ';

      const fileLine = `${f.file}:${f.line || '?'}`;
      const fileMax = 36;
      const fileDisplay = truncatePath(fileLine, fileMax).padEnd(fileMax);
      const titleMax = w - 4 - 8 - fileMax - 6;
      const title = truncate(f.message || '', titleMax);

      const titleStyled = isSelected
        ? `${COLORS.cyan}${COLORS.bold}${title}${COLORS.reset}`
        : title;
      const fileStyled = isSelected ? `${COLORS.cyan}${fileDisplay}${COLORS.reset}` : `${COLORS.dim}${fileDisplay}${COLORS.reset}`;

      console.log(`${cursor} ${checkbox} [${sevTag}] ${fileStyled}  ${titleStyled}`);
    }

    if (end < total) {
      console.log(`  ${COLORS.dim}↓ ${total - end} more below${COLORS.reset}`);
    } else {
      console.log();
    }
  }

  renderDetail() {
    const w = termWidth();
    const f = this.findings[this.selectedIndex];
    if (!f) return;

    console.log(`${COLORS.dim}${'─'.repeat(w)}${COLORS.reset}`);
    const sev = (f.severity || 'medium').toLowerCase();
    const sevColor = SEV_COLORS[sev] || COLORS.dim;
    console.log(`${COLORS.bold}▸ Detail${COLORS.reset}  ${COLORS.dim}(${this.selectedIndex + 1}/${this.findings.length})${COLORS.reset}`);
    console.log(`  ${sevColor}${COLORS.bold}● ${sev.toUpperCase()}${COLORS.reset}  ${COLORS.bold}${f.message || ''}${COLORS.reset}`);
    console.log(`  ${COLORS.dim}${f.file}:${f.line || '?'}${COLORS.reset}`);

    const detailWidth = w - 4;
    if (f.problem) {
      console.log();
      console.log(`  ${COLORS.yellow}Problem${COLORS.reset}`);
      console.log(wrap(f.problem, detailWidth, '  '));
    }
    if (f.suggestion) {
      console.log();
      console.log(`  ${COLORS.green}Suggestion${COLORS.reset}`);
      console.log(wrap(f.suggestion, detailWidth, '  '));
    }
  }

  renderFooter() {
    const w = termWidth();
    console.log();
    console.log(`${COLORS.dim}${'─'.repeat(w)}${COLORS.reset}`);
    const parts = [
      `${COLORS.bold}[↑↓]${COLORS.reset} navigate`,
      `${COLORS.bold}[PgUp/PgDn]${COLORS.reset} page`,
      `${COLORS.bold}[Space]${COLORS.reset} toggle`,
      `${COLORS.bold}[A]${COLORS.reset} all`,
      `${COLORS.bold}[N]${COLORS.reset} none`,
      `${COLORS.bold}[S]${COLORS.reset} solve`,
      `${COLORS.bold}[Esc]${COLORS.reset} exit`
    ];
    console.log(parts.join('  '));
  }

  async selectAndSolve() {
    return new Promise(resolve => {
      this.render();

      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }

      const onData = data => {
        const key = data.toString();
        const total = this.findings.length;

        if (key === '\x1b[A') {
          this.selectedIndex = (this.selectedIndex - 1 + total) % total;
          this.ensureVisible();
          this.render();
        } else if (key === '\x1b[B') {
          this.selectedIndex = (this.selectedIndex + 1) % total;
          this.ensureVisible();
          this.render();
        } else if (key === '\x1b[5~') { // PgUp
          this.selectedIndex = Math.max(0, this.selectedIndex - this.pageSize);
          this.ensureVisible();
          this.render();
        } else if (key === '\x1b[6~') { // PgDn
          this.selectedIndex = Math.min(total - 1, this.selectedIndex + this.pageSize);
          this.ensureVisible();
          this.render();
        } else if (key === '\x1b[H' || key === 'g') { // Home / g
          this.selectedIndex = 0;
          this.ensureVisible();
          this.render();
        } else if (key === '\x1b[F' || key === 'G') { // End / G
          this.selectedIndex = total - 1;
          this.ensureVisible();
          this.render();
        } else if (key === ' ') {
          if (this.selectedIndices.has(this.selectedIndex)) {
            this.selectedIndices.delete(this.selectedIndex);
          } else {
            this.selectedIndices.add(this.selectedIndex);
          }
          this.render();
        } else if (key === 'a' || key === 'A') {
          for (let i = 0; i < total; i++) this.selectedIndices.add(i);
          this.render();
        } else if (key === 'n' || key === 'N') {
          this.selectedIndices.clear();
          this.render();
        } else if (key === 's' || key === 'S') {
          process.stdin.removeListener('data', onData);
          if (process.stdin.isTTY) process.stdin.setRawMode(false);
          const selected = Array.from(this.selectedIndices).map(i => this.findings[i]);
          resolve(selected.length > 0 ? selected : null);
        } else if (key === '\x1b' || key === 'q' || key === 'Q') {
          process.stdin.removeListener('data', onData);
          if (process.stdin.isTTY) process.stdin.setRawMode(false);
          resolve(null);
        } else if (key === '\x03') {
          process.exit(0);
        }
      };

      process.stdin.on('data', onData);
    });
  }
}

export class Settings {
  constructor(settings) {
    this.settings = settings;
    this.selectedIndex = 0;
    this.values = {};
    this.onUpdate = null; // callback when values change
  }

  getDisplayValue(setting) {
    const val = this.values[setting.key];
    if (setting.display) {
      return setting.display(val);
    }
    return String(val);
  }

  render() {
    console.clear();
    this.renderHeader();
    this.renderSettings();
    this.renderFooter();
  }

  renderHeader() {
    const width = 50;
    console.log(`\n${COLORS.cyan}┌${'─'.repeat(width)}┐${COLORS.reset}`);
    console.log(`${COLORS.cyan}│${' '.repeat(Math.floor((width - 8) / 2))}Settings${' '.repeat(width - Math.floor((width - 8) / 2) - 8)}│${COLORS.reset}`);
    console.log(`${COLORS.cyan}└${'─'.repeat(width)}┘${COLORS.reset}`);
  }

  renderSettings() {
    this.settings.forEach((setting, index) => {
      // Skip separators from selection logic but render them
      if (setting.separator) {
        console.log();
        return;
      }

      const isSelected = index === this.selectedIndex;
      const prefix = isSelected ? `${COLORS.cyan}▶${COLORS.reset}` : ' ';
      const name = isSelected ? `${COLORS.bold}${setting.name}${COLORS.reset}` : setting.name;
      const displayVal = this.getDisplayValue(setting);
      const dots = '.'.repeat(Math.max(1, 35 - setting.name.length - displayVal.length));
      const value = isSelected ? `${COLORS.cyan}${displayVal}${COLORS.reset}` : displayVal;

      console.log(`${prefix} ${name} ${COLORS.dim}${dots}${COLORS.reset} ${value}`);
    });
  }

  renderFooter() {
    console.log();
    const parts = [
      `${COLORS.bold}[↑↓]${COLORS.reset} navigate`,
      `${COLORS.bold}[←→]${COLORS.reset} change`,
      `${COLORS.bold}[S]${COLORS.reset} save`,
      `${COLORS.bold}[Esc]${COLORS.reset} back`
    ];
    const footer = parts.join('  ');
    console.log(`${footer}`);
  }

  exit() {
    if (this._resolve) {
      if (this._onData) process.stdin.removeListener('data', this._onData);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      const r = this._resolve;
      this._resolve = null;
      r(this.values);
    }
  }

  async edit() {
    return new Promise(resolve => {
      this._resolve = resolve;
      this.render();

      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }

      const onData = data => {
        const key = data.toString();
        const current = this.settings[this.selectedIndex];

        // Skip separators
        if (current.separator) return;

        if (key === '\x1b[A') { // Up arrow
          do {
            this.selectedIndex = (this.selectedIndex - 1 + this.settings.length) % this.settings.length;
          } while (this.settings[this.selectedIndex].separator);
          this.render();
        } else if (key === '\x1b[B') { // Down arrow
          do {
            this.selectedIndex = (this.selectedIndex + 1) % this.settings.length;
          } while (this.settings[this.selectedIndex].separator);
          this.render();
        } else if ((key === '\x1b[C' || key === '\x1b[D') && current.options) { // Right/Left arrow
          const options = current.options;
          const idx = options.indexOf(this.values[current.key]);
          const newIdx = key === '\x1b[C' ? (idx + 1) % options.length : (idx - 1 + options.length) % options.length;
          this.values[current.key] = options[newIdx];

          // Notify about change (for dynamic updates)
          if (this.onUpdate) {
            this.onUpdate(current.key, this.values[current.key]);
          }

          this.render();
        } else if (key === '\r' || key === '\n') { // Enter - edit special fields
          if (current.special === true) {
            // Remove listener temporarily for hidden input
            process.stdin.removeListener('data', onData);
            if (process.stdin.isTTY) {
              process.stdin.setRawMode(false);
            }

            // Call the edit callback if defined
            if (this.onEdit) {
              this.onEdit(current.key, current.name).then(newValue => {
                if (newValue !== undefined) {
                  this.values[current.key] = newValue;
                  if (this.onUpdate) {
                    this.onUpdate(current.key, newValue);
                  }
                }
                // Only re-attach if edit() hasn't already resolved (e.g., via exit())
                if (!this._resolve) return;
                if (process.stdin.isTTY) {
                  process.stdin.setRawMode(true);
                }
                this.render();
                process.stdin.on('data', onData);
              });
            }
          }
        } else if (key === 's' || key === 'S') {
          process.stdin.removeListener('data', onData);
          if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
          }
          this._resolve = null;
          resolve(this.values);
        } else if (key === '\x1b') { // Escape
          process.stdin.removeListener('data', onData);
          if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
          }
          this._resolve = null;
          resolve(null);
        } else if (key === '\x03') { // Ctrl+C
          process.exit(0);
        }
      };

      this._onData = onData;
      process.stdin.on('data', onData);
    });
  }
}
