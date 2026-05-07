const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  red: '\x1b[31m',
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
  }

  init(commitMsg, branchRef, agentNames) {
    console.log(NEXUS_LOGO);
    console.log(`\n${ANSI.bold}NEXUS${ANSI.reset} v${this.version}\n`);
    console.log(`${ANSI.bold}Reviewing:${ANSI.reset} ${commitMsg}`);
    console.log(`${branchRef}\n`);
    console.log(`${ANSI.bold}Analyzing...${ANSI.reset}\n`);

    agentNames.forEach(name => {
      this.agents[name] = { status: 'pending', findings: 0, duration: 0, startTime: 0 };
    });
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

    // Print status update
    if (state === 'running') {
      process.stdout.write(`${ANSI.cyan}⟳${ANSI.reset} ${agentName} ${ANSI.dim}analyzing...${ANSI.reset}`);
    } else if (state === 'done') {
      const duration = agent.duration || (Date.now() - (agent.startTime || Date.now()));
      const durationStr = (duration / 1000).toFixed(1);
      const stats = [
        agent.findings && `${agent.findings} finding${agent.findings === 1 ? '' : 's'}`,
        agent.skipped && `${agent.skipped} skipped`,
        `${durationStr}s`
      ].filter(Boolean).join(' · ');

      process.stdout.write(` ${ANSI.green}✓${ANSI.reset}`);
      if (stats) process.stdout.write(` ${ANSI.dim}${stats}${ANSI.reset}`);
      process.stdout.write('\n');
    } else if (state === 'failed') {
      process.stdout.write(` ${ANSI.red}✗${ANSI.reset}`);
      if (agent.error) process.stdout.write(` ${ANSI.red}${agent.error}${ANSI.reset}`);
      process.stdout.write('\n');
    }
  }

  update(step, total, completedCount = 0) {
    // No-op
  }

  finish() {
    console.log();
  }
}
