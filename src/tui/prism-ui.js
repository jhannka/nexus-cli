import blessed from 'blessed';

const NEXUS_LOGO = `
███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝`;

export class PrismUI {
  constructor(version) {
    this.version = version;
    this.agents = {};
    this.screen = blessed.screen({
      mouse: false,
      keyboard: false,
      smartCSR: true,
      title: 'NEXUS Code Review'
    });

    // Main container
    this.mainBox = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%'
    });

    // Logo
    this.logoBox = blessed.box({
      parent: this.mainBox,
      top: 0,
      left: 0,
      content: `{cyan}${NEXUS_LOGO}{/cyan}`,
      height: 7,
      width: '100%'
    });

    // Version
    this.versionBox = blessed.box({
      parent: this.mainBox,
      top: 7,
      left: 0,
      content: `{bold}NEXUS{/bold} v${version}`,
      height: 1,
      width: '100%'
    });

    // Info (commit, branch)
    this.infoBox = blessed.box({
      parent: this.mainBox,
      top: 8,
      left: 0,
      height: 3,
      width: '100%',
      content: ''
    });

    // Agents list
    this.agentsBox = blessed.box({
      parent: this.mainBox,
      top: 11,
      left: 0,
      height: 'shrink',
      width: '100%',
      content: 'Analyzing...\n'
    });

    this.screen.key(['escape', 'q', 'C-c'], () => {
      process.exit(0);
    });
  }

  init(commitMsg, branchRef, agentNames) {
    this.infoBox.setContent(`{bold}Reviewing:{/bold} ${commitMsg}\n{dim}${branchRef}{/dim}`);

    agentNames.forEach(name => {
      this.agents[name] = { status: 'pending', findings: 0, duration: 0, startTime: 0 };
    });

    this.updateAgentsList();

    // Render immediately and focus screen
    this.screen.render();
    this.screen.focus();
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

    this.updateAgentsList();
    this.screen.render();
  }

  updateAgentsList() {
    const lines = [];
    lines.push('{bold}Agents:{/bold}');

    for (const [agentName, agent] of Object.entries(this.agents)) {
      let line = '';

      switch (agent.status) {
        case 'pending':
          line = `  {dim}○ ${agentName}{/dim}`;
          break;
        case 'running':
          line = `  {cyan}⟳ ${agentName} {dim}analyzing...{/dim}{/cyan}`;
          break;
        case 'done': {
          const duration = agent.duration || (Date.now() - (agent.startTime || Date.now()));
          const durationStr = (duration / 1000).toFixed(1);
          const stats = [
            agent.findings && `${agent.findings} finding${agent.findings === 1 ? '' : 's'}`,
            agent.skipped && `${agent.skipped} skipped`,
            `${durationStr}s`
          ].filter(Boolean).join(' · ');

          line = `  {green}✓ ${agentName}{/green}`;
          if (stats) line += ` {dim}${stats}{/dim}`;
          break;
        }
        case 'failed':
          line = `  {red}✗ ${agentName}{/red}`;
          if (agent.error) line += ` {red,dim}${agent.error}{/red,dim}`;
          break;
      }

      lines.push(line);
    }

    this.agentsBox.setContent(lines.join('\n'));
  }

  update(step, total, completedCount = 0) {
    // Update status if needed
    this.screen.render();
  }

  finish() {
    // Keep screen visible, wait for user to press key
    const key = blessed.box({
      parent: this.screen,
      top: this.screen.height - 2,
      left: 0,
      content: '{dim}Press any key to continue...{/dim}',
      height: 1
    });

    this.screen.key(['escape', 'q', 'C-c', 'return', 'space'], () => {
      this.screen.destroy();
      process.exit(0);
    });

    this.screen.render();
  }
}
