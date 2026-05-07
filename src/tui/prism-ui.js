const ESC = '\x1b';
const ANSI = {
  reset: `${ESC}[0m`,
  bold: `${ESC}[1m`,
  dim: `${ESC}[2m`,
  cyan: `${ESC}[36m`,
  green: `${ESC}[32m`,
  red: `${ESC}[31m`,
  yellow: `${ESC}[33m`,
  cursorHome: `${ESC}[H`,
  clearScreen: `${ESC}[2J`,
  clearDown: `${ESC}[J`,
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
    this.lastStep = 1;
    this.lastTotal = 5;
    this.commitMsg = '';
    this.branchRef = '';
    this.renderTimer = null;
  }

  init(commitMsg, branchRef, agentNames) {
    this.commitMsg = commitMsg;
    this.branchRef = branchRef;
    agentNames.forEach(name => {
      this.agents[name] = { status: 'pending', findings: 0, duration: 0, startTime: 0 };
    });
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
    const lines = [];

    lines.push(NEXUS_LOGO);
    lines.push('');
    lines.push(`${ANSI.bold}NEXUS${ANSI.reset} v${this.version}`);
    lines.push('');
    lines.push(`${ANSI.bold}Reviewing:${ANSI.reset} ${this.commitMsg}`);
    lines.push(this.branchRef);
    lines.push('');

    const completed = Object.values(this.agents).filter(a => a.status === 'done' || a.status === 'failed').length;
    const total = Object.keys(this.agents).length;
    lines.push(`${ANSI.dim}»${ANSI.reset} Step ${this.lastStep}/${this.lastTotal}: Running ${total} agents...`);

    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    const barWidth = 20;
    const filled = Math.round((percent / 100) * barWidth);
    const empty = barWidth - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    lines.push(`${ANSI.cyan}[${bar}]${ANSI.reset} ${percent}%`);
    lines.push('');

    lines.push(`${ANSI.bold}Agents (${completed}/${total} complete):${ANSI.reset}`);

    const maxNameLen = Math.max(...Object.keys(this.agents).map(n => n.length), 1);
    for (const [agentName, agent] of Object.entries(this.agents)) {
      const padded = agentName.padEnd(maxNameLen);
      let line = '';
      switch (agent.status) {
        case 'pending':
          line = `  ${ANSI.dim}○ ${padded}${ANSI.reset}`;
          break;
        case 'running':
          line = `  ${ANSI.cyan}⟳${ANSI.reset} ${padded}    ${ANSI.dim}analyzing...${ANSI.reset}`;
          break;
        case 'done': {
          const duration = agent.duration || (Date.now() - (agent.startTime || Date.now()));
          const durationStr = (duration / 1000).toFixed(1);
          const stats = [
            agent.findings && `${agent.findings} finding${agent.findings === 1 ? '' : 's'}`,
            `${durationStr}s`
          ].filter(Boolean).join(' · ');
          line = `  ${ANSI.green}✓${ANSI.reset} ${padded} ${ANSI.dim}${stats}${ANSI.reset}`;
          break;
        }
        case 'failed':
          line = `  ${ANSI.red}✗${ANSI.reset} ${padded}`;
          if (agent.error) line += ` ${ANSI.dim}${agent.error}${ANSI.reset}`;
          break;
      }
      lines.push(line);
    }
    lines.push('');

    process.stdout.write(ANSI.cursorHome + ANSI.clearDown + lines.join('\n') + '\n');
  }

  finish() {
    this.render();
    process.stdout.write('\n');
  }
}
