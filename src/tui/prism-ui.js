const ESC = '\x1b';
const ANSI = {
  reset: `${ESC}[0m`,
  bold: `${ESC}[1m`,
  dim: `${ESC}[2m`,
  cyan: `${ESC}[36m`,
  green: `${ESC}[32m`,
  red: `${ESC}[31m`,
  yellow: `${ESC}[33m`,
  clearLine: `${ESC}[2K`,
  cursorHome: `${ESC}[H`,
  cursorUp: (n) => `${ESC}[${n}A`,
};

const NEXUS_LOGO = `${ANSI.cyan}${ANSI.bold}
███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝${ANSI.reset}`;

export class PrismUI {
  constructor(version) {
    this.version = version;
    this.agents = {};
    this.dynamicStartLine = 0;
    this.dynamicLineCount = 0;
    this.lastStep = 1;
    this.lastTotal = 5;
  }

  init(commitMsg, branchRef, agentNames) {
    console.clear();
    process.stdout.write(NEXUS_LOGO);
    process.stdout.write(`\n${ANSI.bold}NEXUS${ANSI.reset} v${this.version}\n\n`);
    process.stdout.write(`${ANSI.bold}Reviewing:${ANSI.reset} ${commitMsg}\n`);
    process.stdout.write(`${branchRef}\n\n`);

    agentNames.forEach(name => {
      this.agents[name] = { status: 'pending', findings: 0, duration: 0, startTime: 0 };
    });

    this.dynamicLineCount = 0;
    this.render();
  }

  setAgentState(agentName, state, details = {}) {
    if (!this.agents.hasOwnProperty(agentName)) {
      this.agents[agentName] = { status: 'pending', findings: 0, duration: 0, startTime: 0 };
    }

    const agent = this.agents[agentName];
    agent.status = state;
    Object.assign(agent, details);

    if (state === 'running' && !agent.startTime) {
      agent.startTime = Date.now();
    }

    this.render();
  }

  update(step, total, completedCount = 0) {
    this.lastStep = step;
    this.lastTotal = total;
    this.render();
  }

  render() {
    const lines = this.buildDynamicBlock();

    if (this.dynamicLineCount > 0) {
      // Move cursor up to previous dynamic block and overwrite
      process.stdout.write(ANSI.cursorUp(this.dynamicLineCount));
    }

    // Write dynamic block
    for (const line of lines) {
      process.stdout.write(ANSI.clearLine + line + '\n');
    }

    this.dynamicLineCount = lines.length;
  }

  buildDynamicBlock() {
    const lines = [];

    // Step and agent count
    const completed = Object.values(this.agents).filter(a => a.status === 'done').length;
    const total = Object.keys(this.agents).length;
    lines.push(`${ANSI.dim}"${ANSI.reset} Step ${this.lastStep}/${this.lastTotal}: Running ${total} agents...`);

    // Progress bar
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    const barWidth = 20;
    const filled = Math.round((percent / 100) * barWidth);
    const empty = barWidth - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    lines.push(`${ANSI.cyan}[${bar}]${ANSI.reset} ${percent}%`);

    // Blank line
    lines.push('');

    // Agents header
    lines.push(`${ANSI.bold}Agents (${completed}/${total} complete):${ANSI.reset}`);

    // Agent list
    const maxNameLen = Math.max(...Object.keys(this.agents).map(n => n.length));
    for (const [agentName, agent] of Object.entries(this.agents)) {
      let line = '';
      const padded = agentName.padEnd(maxNameLen);

      switch (agent.status) {
        case 'pending':
          line = `  ${ANSI.dim}○ ${padded}${ANSI.reset}`;
          break;
        case 'running':
          line = `  ${ANSI.cyan}⟳ ${padded}    ${ANSI.dim}analyzing...${ANSI.reset}${ANSI.reset}`;
          break;
        case 'done': {
          const duration = agent.duration || (Date.now() - (agent.startTime || Date.now()));
          const durationStr = (duration / 1000).toFixed(1);
          const stats = [
            agent.findings && `${agent.findings} finding${agent.findings === 1 ? '' : 's'}`,
            agent.skipped && `${agent.skipped} skipped`,
            `${durationStr}s`
          ].filter(Boolean).join(' · ');

          line = `  ${ANSI.green}✓ ${padded}${ANSI.reset}`;
          if (stats) line += ` ${ANSI.dim}${stats}${ANSI.reset}`;
          break;
        }
        case 'failed':
          line = `  ${ANSI.red}✗ ${padded}${ANSI.reset}`;
          if (agent.error) line += ` ${ANSI.dim}${agent.error}${ANSI.reset}`;
          break;
      }

      lines.push(line);
    }

    // Blank line
    lines.push('');

    return lines;
  }

  finish() {
    console.log();
  }
}
