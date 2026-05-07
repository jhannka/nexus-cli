const ESC = '\x1b';
const C = {
  reset: `${ESC}[0m`,
  bold: `${ESC}[1m`,
  dim: `${ESC}[2m`,
  italic: `${ESC}[3m`,
  underline: `${ESC}[4m`,
  cyan: `${ESC}[36m`,
  green: `${ESC}[32m`,
  red: `${ESC}[31m`,
  yellow: `${ESC}[33m`,
  magenta: `${ESC}[35m`,
  blue: `${ESC}[34m`,
  gray: `${ESC}[90m`,
  bgCyan: `${ESC}[46m`,
  bgBlue: `${ESC}[44m`,
  cursorHome: `${ESC}[H`,
  clearDown: `${ESC}[J`,
};

function parseSolutions(rawText) {
  const blocks = rawText.split(/\n(?=##\s)/g).map(b => b.trim()).filter(Boolean);
  return blocks.map(block => {
    const titleMatch = block.match(/^##\s*(.+?)$/m);
    const title = titleMatch ? titleMatch[1].trim() : 'Solution';

    const problemMatch = block.match(/\*\*(?:Problema|Problem)\*\*\s*:\s*([\s\S]*?)(?=\*\*(?:Solución|Solution)\*\*|$)/i);
    const problem = problemMatch ? problemMatch[1].trim() : '';

    const solutionMatch = block.match(/\*\*(?:Solución|Solution)\*\*\s*:\s*([\s\S]*?)$/i);
    let solutionText = solutionMatch ? solutionMatch[1].trim() : '';

    const codeMatch = solutionText.match(/```(\w+)?\n([\s\S]*?)```/);
    const code = codeMatch ? codeMatch[2].trim() : '';
    const codeLang = codeMatch ? (codeMatch[1] || 'text') : '';
    const explanation = solutionText.replace(/```[\s\S]*?```/g, '').trim();

    return { title, problem, code, codeLang, explanation };
  });
}

function highlightCode(code, lang) {
  if (!code) return '';
  const lines = code.split('\n');
  const keywords = /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|new|this|public|private|interface|type|extends|implements)\b/g;
  const strings = /(['"`])(?:\\.|(?!\1).)*\1/g;
  const comments = /\/\/.*$|\/\*[\s\S]*?\*\//g;
  const numbers = /\b\d+\b/g;

  return lines.map(line => {
    let highlighted = line;
    highlighted = highlighted.replace(comments, m => `${C.gray}${m}${C.reset}`);
    highlighted = highlighted.replace(strings, m => `${C.green}${m}${C.reset}`);
    highlighted = highlighted.replace(keywords, m => `${C.magenta}${m}${C.reset}`);
    highlighted = highlighted.replace(numbers, m => `${C.yellow}${m}${C.reset}`);
    return `  ${C.dim}│${C.reset} ${highlighted}`;
  }).join('\n');
}

function severityFromTitle(title) {
  const lower = title.toLowerCase();
  if (/critical|crítico|secret|credential|injection|inyec|eval/.test(lower)) return { label: 'CRITICAL', color: C.magenta };
  if (/high|sql|xss|traversal|recorrido|http insegur|secrets/.test(lower)) return { label: 'HIGH', color: C.red };
  if (/medium|warning|null|undefined|annotation|tipo/.test(lower)) return { label: 'MEDIUM', color: C.yellow };
  return { label: 'INFO', color: C.cyan };
}

export class SolutionsViewer {
  constructor(rawText) {
    this.solutions = parseSolutions(rawText);
    this.index = 0;
  }

  render() {
    const total = this.solutions.length;
    const cur = this.solutions[this.index];
    const sev = severityFromTitle(cur.title);

    const lines = [];
    const header = ` Solutions  ${this.index + 1}/${total} `;
    lines.push(`${C.bgCyan}${C.bold}${header}${C.reset}`);
    lines.push('');

    lines.push(`${sev.color}${C.bold}● ${sev.label}${C.reset}  ${C.bold}${cur.title}${C.reset}`);
    lines.push(`${C.dim}${'─'.repeat(60)}${C.reset}`);
    lines.push('');

    if (cur.problem) {
      lines.push(`${C.yellow}${C.bold}▸ Problem${C.reset}`);
      lines.push(`  ${cur.problem}`);
      lines.push('');
    }

    if (cur.explanation) {
      lines.push(`${C.cyan}${C.bold}▸ Explanation${C.reset}`);
      lines.push(`  ${cur.explanation}`);
      lines.push('');
    }

    if (cur.code) {
      lines.push(`${C.green}${C.bold}▸ Solution${C.reset}  ${C.dim}(${cur.codeLang})${C.reset}`);
      lines.push(highlightCode(cur.code, cur.codeLang));
      lines.push('');
    }

    lines.push('');
    lines.push(`${C.dim}${'─'.repeat(60)}${C.reset}`);

    const progressBar = this.renderProgress(total);
    lines.push(progressBar);
    lines.push('');

    lines.push(`${C.bold}[←→]${C.reset} Navigate  ${C.bold}[N]${C.reset} Next  ${C.bold}[P]${C.reset} Prev  ${C.bold}[Q]${C.reset} Back to menu`);

    process.stdout.write(C.cursorHome + C.clearDown + lines.join('\n') + '\n');
  }

  renderProgress(total) {
    const dots = [];
    for (let i = 0; i < total; i++) {
      if (i === this.index) dots.push(`${C.cyan}●${C.reset}`);
      else dots.push(`${C.dim}○${C.reset}`);
    }
    return `  ${dots.join(' ')}`;
  }

  async show() {
    if (this.solutions.length === 0) {
      console.log(`${C.dim}No solutions to display.${C.reset}`);
      return;
    }

    return new Promise(resolve => {
      console.clear();
      this.render();

      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }

      const onData = data => {
        const key = data.toString();

        if (key === '\x1b[C' || key === 'n' || key === 'N' || key === ' ') {
          this.index = (this.index + 1) % this.solutions.length;
          this.render();
        } else if (key === '\x1b[D' || key === 'p' || key === 'P') {
          this.index = (this.index - 1 + this.solutions.length) % this.solutions.length;
          this.render();
        } else if (key === '\x1b[A') {
          this.index = (this.index - 1 + this.solutions.length) % this.solutions.length;
          this.render();
        } else if (key === '\x1b[B') {
          this.index = (this.index + 1) % this.solutions.length;
          this.render();
        } else if (key === 'q' || key === 'Q' || key === '\x1b' || key === '\x03' || key === '\r' || key === '\n') {
          process.stdin.removeListener('data', onData);
          if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
          }
          console.clear();
          resolve();
        }
      };

      process.stdin.on('data', onData);
    });
  }
}
