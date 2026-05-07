const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  bgCyan: '\x1b[46m'
};

const NEXUS_LOGO = `${COLORS.cyan}${COLORS.bold}
███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝${COLORS.reset}`;

export class ConfigurationMenu {
  constructor(agents, severities) {
    this.agents = agents; // Array of agent names
    this.severities = severities; // ['critical', 'high', 'medium', 'low']
    this.selectedAgents = new Set(agents); // All selected by default
    this.selectedSeverity = 'medium';
    this.selectedIndex = 0;
    this.items = this.buildItems();
  }

  buildItems() {
    const items = [];

    // Agents section
    items.push({ type: 'header', label: 'Select Agents' });
    this.agents.forEach((agent, i) => {
      items.push({
        type: 'agent',
        key: `agent_${i}`,
        label: agent,
        value: true // All agents on by default
      });
    });

    // Severity section
    items.push({ type: 'separator' });
    items.push({ type: 'header', label: 'Minimum Severity' });
    this.severities.forEach(severity => {
      items.push({
        type: 'severity',
        key: `severity_${severity}`,
        label: severity,
        value: severity === 'medium'
      });
    });

    return items;
  }

  render() {
    console.clear();
    console.log(NEXUS_LOGO);
    console.log(`\n${COLORS.cyan}${COLORS.bold}NEXUS Configuration${COLORS.reset}\n`);
    console.log(`${COLORS.bold}Select agents and minimum severity${COLORS.reset}\n`);

    this.items.forEach((item, idx) => {
      const isSelected = idx === this.selectedIndex;
      const prefix = isSelected ? `${COLORS.bgCyan} ${COLORS.reset}` : ' ';

      if (item.type === 'header') {
        console.log(`\n${prefix} ${COLORS.bold}${item.label}${COLORS.reset}`);
      } else if (item.type === 'separator') {
        console.log('');
      } else if (item.type === 'agent') {
        const checked = this.selectedAgents.has(item.label) ? '☑' : '☐';
        const label = isSelected ? `${COLORS.cyan}${COLORS.bold}${item.label}${COLORS.reset}` : item.label;
        console.log(`${prefix} ${checked} ${label}`);
      } else if (item.type === 'severity') {
        const selected = this.selectedSeverity === item.label ? '◉' : '○';
        const label = isSelected ? `${COLORS.cyan}${COLORS.bold}${item.label}${COLORS.reset}` : item.label;
        console.log(`${prefix} ${selected} ${label}`);
      }
    });

    console.log(`\n${COLORS.bold}[↑↓]${COLORS.reset} Navigate  ${COLORS.bold}[Space]${COLORS.reset} Toggle  ${COLORS.bold}[Enter]${COLORS.reset} Start  ${COLORS.bold}[Q]${COLORS.reset} Quit`);
  }

  async configure() {
    return new Promise(resolve => {
      this.render();

      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }

      const onData = data => {
        const key = data.toString();
        const current = this.items[this.selectedIndex];

        if (key === '\x1b[A') { // Up arrow
          do {
            this.selectedIndex = (this.selectedIndex - 1 + this.items.length) % this.items.length;
          } while (this.items[this.selectedIndex].type === 'header' || this.items[this.selectedIndex].type === 'separator');
          this.render();
        } else if (key === '\x1b[B') { // Down arrow
          do {
            this.selectedIndex = (this.selectedIndex + 1) % this.items.length;
          } while (this.items[this.selectedIndex].type === 'header' || this.items[this.selectedIndex].type === 'separator');
          this.render();
        } else if (key === ' ') { // Space - toggle
          if (current.type === 'agent') {
            if (this.selectedAgents.has(current.label)) {
              this.selectedAgents.delete(current.label);
            } else {
              this.selectedAgents.add(current.label);
            }
            this.render();
          } else if (current.type === 'severity') {
            this.selectedSeverity = current.label;
            this.render();
          }
        } else if (key === '\r' || key === '\n') { // Enter
          process.stdin.removeListener('data', onData);
          if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
          }
          resolve({
            agents: Array.from(this.selectedAgents),
            severity: this.selectedSeverity
          });
        } else if (key === '\x03' || key === 'q' || key === 'Q' || key === '\x1b') { // Ctrl+C, Q, Esc
          process.stdin.removeListener('data', onData);
          if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
          }
          resolve({ cancelled: true });
        }
      };

      process.stdin.on('data', onData);
    });
  }
}
