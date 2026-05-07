const ESC = '\x1b';

const ANSI = {
  reset: `${ESC}[0m`,
  bold: `${ESC}[1m`,
  dim: `${ESC}[2m`,
  cyan: `${ESC}[36m`,
  green: `${ESC}[32m`,
  red: `${ESC}[31m`,
  clearLine: `${ESC}[2K`,
  col1: `${ESC}[1G`,
  cursorUp: (n) => `${ESC}[${n}A`,
  hideCursor: `${ESC}[?25l`,
  showCursor: `${ESC}[?25h`,
};

const SUPPORTS_ANSI = process.stdout.isTTY &&
  (process.platform !== 'win32' || process.env.WT_SESSION != null || process.env.ConEmuPID != null);

const NEXUS_LOGO = `${ANSI.cyan}${ANSI.bold}
███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝${ANSI.reset}`;

const LOGO_LINES = 7; // blank line + 6 logo lines

const AGENT_ICONS = {
  pending: '○',
  running: `${ANSI.cyan}⟳${ANSI.reset}`,
  done: `${ANSI.green}✓${ANSI.reset}`,
  failed: `${ANSI.red}✗${ANSI.reset}`,
};

export class PrismUI {
  constructor(version) {
    this.version = version;
    this.agents = {};
    this.dynamicLineCount = 0;
    this.lastStep = 0;
    this.lastTotal = 0;
  }

  init(commitMsg, branchRef, agentNames) {
    this._write(NEXUS_LOGO);
    this._write(`\n${ANSI.bold}NEXUS${ANSI.reset} v${this.version}\n`);
    this._write(`\nReviewing: ${commitMsg}\n`);
    this._write(`${branchRef}\n`);

    agentNames.forEach(name => {
      this.agents[name] = 'pending';
    });

    this.dynamicLineCount = 4 + agentNames.length;

    if (SUPPORTS_ANSI) {
      this._write(ANSI.hideCursor);
    }

    const lines = this._renderDynamicBlock(1, 5, 0);
    for (const line of lines) {
      this._write(line + '\n');
    }
  }

  update(step, total, completedCount = 0) {
    this.lastStep = step;
    this.lastTotal = total;

    if (SUPPORTS_ANSI) {
      this._redraw(step, total, completedCount);
    } else {
      this._renderDynamicBlock(step, total, completedCount);
    }
  }

  setAgentState(agentName, state) {
    if (this.agents.hasOwnProperty(agentName)) {
      this.agents[agentName] = state;
      const completed = Object.values(this.agents).filter(s => s === 'done').length;
      this.update(this.lastStep, this.lastTotal, completed);
    }
  }

  finish() {
    if (SUPPORTS_ANSI) {
      this._write(ANSI.showCursor);
    }
    this._write('\n');
  }

  _renderProgressBar(completedCount, totalCount, width = 20) {
    const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return `${ANSI.cyan}[${bar}]${ANSI.reset} ${percent}%`;
  }

  _renderDynamicBlock(step, total, completedCount = 0) {
    const lines = [];
    lines.push('');
    lines.push(`${ANSI.dim}"${ANSI.reset} Step ${step}/${total}: Running ${Object.keys(this.agents).length} agents...`);
    lines.push(this._renderProgressBar(completedCount, Object.keys(this.agents).length));
    lines.push('');
    lines.push(`${ANSI.bold}Agents (${completedCount}/${Object.keys(this.agents).length} complete):${ANSI.reset}`);

    const maxNameLen = Math.max(...Object.keys(this.agents).map(n => n.length));

    for (const [agentName, state] of Object.entries(this.agents)) {
      const icon = AGENT_ICONS[state] || AGENT_ICONS.pending;
      const padded = agentName.padEnd(maxNameLen);
      let line = `  ${icon} ${padded}`;

      if (state === 'running') {
        line += `  ${ANSI.dim}analyzing...${ANSI.reset}`;
      }

      lines.push(line);
    }

    return lines;
  }

  _redraw(step, total, completedCount) {
    const lines = this._renderDynamicBlock(step, total, completedCount);

    if (SUPPORTS_ANSI) {
      this._write(ANSI.cursorUp(this.dynamicLineCount));

      for (const line of lines) {
        this._write(ANSI.clearLine + ANSI.col1 + line + '\n');
      }
    } else {
      for (const line of lines) {
        console.log(line);
      }
    }
  }

  _write(str) {
    process.stdout.write(str);
  }
}
