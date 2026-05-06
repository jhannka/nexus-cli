const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  bgCyan: '\x1b[46m',
  bgBlack: '\x1b[40m'
};

export class Menu {
  constructor(items) {
    this.items = items;
    this.selectedIndex = 0;
  }

  render() {
    console.clear();
    this.renderHeader();
    this.renderItems();
    this.renderFooter();
  }

  renderHeader() {
    const width = 50;
    console.log(`\n${COLORS.cyan}┌${'─'.repeat(width)}┐${COLORS.reset}`);
    console.log(`${COLORS.cyan}│${' '.repeat(Math.floor((width - 5) / 2))}NEXUS${' '.repeat(width - Math.floor((width - 5) / 2) - 5)}│${COLORS.reset}`);
    console.log(`${COLORS.cyan}└${'─'.repeat(width)}┘${COLORS.reset}`);
  }

  renderItems() {
    console.log(`📋 ${COLORS.bold}Main Menu${COLORS.reset}\n`);

    this.items.forEach((item, index) => {
      const isSelected = index === this.selectedIndex;
      const prefix = isSelected ? `${COLORS.bgCyan}●${COLORS.reset}` : '  ';
      const label = isSelected
        ? `${COLORS.cyan}${COLORS.bold}${item.label}${COLORS.reset}`
        : item.label;
      const sublabel = item.sublabel ? ` ${COLORS.dim}${item.sublabel}${COLORS.reset}` : '';

      console.log(`${prefix} ${label}${sublabel}`);
    });
  }

  renderFooter() {
    console.log();
    const footer = `${COLORS.bold}[↑↓]${COLORS.reset} Navigate  ${COLORS.bold}[Enter]${COLORS.reset} Select`;
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
        } else if (key === '\x03') { // Ctrl+C
          process.exit(0);
        }
      };

      process.stdin.on('data', onData);
    });
  }
}

export class ResultsMenu {
  constructor(findings) {
    this.findings = findings;
    this.selectedIndices = new Set();
    this.selectedIndex = 0;
  }

  render() {
    console.clear();
    this.renderHeader();
    this.renderFindings();
    this.renderFooter();
  }

  renderHeader() {
    const width = 60;
    console.log(`\n${COLORS.cyan}┌${'─'.repeat(width)}┐${COLORS.reset}`);
    console.log(`${COLORS.cyan}│${' '.repeat(Math.floor((width - 15) / 2))}Code Review Results${' '.repeat(width - Math.floor((width - 15) / 2) - 18)}│${COLORS.reset}`);
    console.log(`${COLORS.cyan}└${'─'.repeat(width)}┘${COLORS.reset}`);
  }

  renderFindings() {
    console.log(`${COLORS.bold}Found ${this.findings.length} issue(s)${COLORS.reset}\n`);

    this.findings.forEach((finding, index) => {
      const isSelected = index === this.selectedIndex;
      const isChecked = this.selectedIndices.has(index);

      const prefix = isSelected
        ? `${COLORS.bgCyan}${isChecked ? '✓' : ' '}${COLORS.reset}`
        : ` ${isChecked ? '✓' : ' '}`;

      const severity = {
        error: `${COLORS.red}${finding.severity.toUpperCase()}${COLORS.reset}`,
        warning: `${COLORS.yellow}${finding.severity.toUpperCase()}${COLORS.reset}`
      }[finding.severity] || finding.severity;

      const label = isSelected
        ? `${COLORS.cyan}${COLORS.bold}${finding.file}:${finding.line || '?'}${COLORS.reset}`
        : `${finding.file}:${finding.line || '?'}`;

      console.log(`${prefix} [${severity}] ${label}`);
      console.log(`   ${finding.message}`);
      if (finding.suggestion) {
        console.log(`   💡 ${COLORS.dim}${finding.suggestion}${COLORS.reset}`);
      }
      console.log();
    });
  }

  renderFooter() {
    console.log();
    const parts = [
      `${COLORS.bold}[↑↓]${COLORS.reset} navigate`,
      `${COLORS.bold}[Space]${COLORS.reset} toggle`,
      `${COLORS.bold}[S]${COLORS.reset} solve selected`,
      `${COLORS.bold}[Esc]${COLORS.reset} exit`
    ];
    const footer = parts.join('  ');
    console.log(`${footer}`);
  }

  async selectAndSolve() {
    return new Promise(resolve => {
      this.render();

      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }

      const onData = data => {
        const key = data.toString();

        if (key === '\x1b[A') { // Up arrow
          this.selectedIndex = (this.selectedIndex - 1 + this.findings.length) % this.findings.length;
          this.render();
        } else if (key === '\x1b[B') { // Down arrow
          this.selectedIndex = (this.selectedIndex + 1) % this.findings.length;
          this.render();
        } else if (key === ' ') { // Space - toggle selection
          if (this.selectedIndices.has(this.selectedIndex)) {
            this.selectedIndices.delete(this.selectedIndex);
          } else {
            this.selectedIndices.add(this.selectedIndex);
          }
          this.render();
        } else if (key === 's' || key === 'S') { // S - solve selected
          process.stdin.removeListener('data', onData);
          if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
          }
          const selected = Array.from(this.selectedIndices).map(i => this.findings[i]);
          resolve(selected.length > 0 ? selected : null);
        } else if (key === '\x1b') { // Escape
          process.stdin.removeListener('data', onData);
          if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
          }
          resolve(null);
        } else if (key === '\x03') { // Ctrl+C
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

  async edit() {
    return new Promise(resolve => {
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
                // Re-attach listener and render
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
          resolve(this.values);
        } else if (key === '\x1b') { // Escape
          process.stdin.removeListener('data', onData);
          if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
          }
          resolve(null);
        } else if (key === '\x03') { // Ctrl+C
          process.exit(0);
        }
      };

      process.stdin.on('data', onData);
    });
  }
}
