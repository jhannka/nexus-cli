import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { AIProvider } from '../ai/provider.js';

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
  bgGreen: `${ESC}[42m`,
  bgRed: `${ESC}[41m`,
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

function extractJSON(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

async function generateFix(finding, projectRoot, aiConfig) {
  const filePath = resolve(projectRoot, finding.file);
  let fileContent;
  try {
    fileContent = readFileSync(filePath, 'utf-8');
  } catch (e) {
    return { error: `Cannot read file: ${e.message}` };
  }

  const language = aiConfig.language || 'english';
  const langInst = {
    english: 'Respond in English',
    spanish: 'Responde en español',
    french: 'Répondez en français',
    german: 'Antworte auf Deutsch'
  };

  const prompt = `${langInst[language] || langInst.english}.

You are fixing a specific code issue in a file. Return ONLY a JSON object — no markdown fences, no commentary before or after.

FILE: ${finding.file}
ISSUE: ${finding.message}
SEVERITY: ${finding.severity || 'medium'}

CURRENT FILE CONTENT:
${fileContent.slice(0, 6000)}

Return JSON with this exact structure:
{
  "oldCode": "exact lines from the file above to be replaced — must match character-for-character",
  "newCode": "the replacement lines that fix the issue",
  "reason": "one sentence explanation of the fix"
}

Rules:
- "oldCode" MUST be an exact substring of the file content above (preserve indentation, quotes, semicolons).
- Keep "oldCode" as small as possible — only the lines that change.
- "newCode" replaces "oldCode" entirely. Preserve surrounding indentation.
- If the fix requires new imports, include them in newCode by extending oldCode to cover the import region.`;

  const provider = new AIProvider(aiConfig.provider, aiConfig.apiKey, aiConfig.model);

  try {
    const response = await Promise.race([
      provider.analyze(prompt, { maxTokens: 2000 }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout (60s)')), 60000))
    ]);
    const fix = extractJSON(response);
    if (!fix || !fix.oldCode || !fix.newCode) {
      return { error: 'AI returned invalid or incomplete JSON' };
    }
    if (!fileContent.includes(fix.oldCode)) {
      return { error: 'AI-generated oldCode not found in file (hallucination)' };
    }
    return { fix, fileContent, filePath };
  } catch (e) {
    return { error: e.message };
  }
}

function renderDiff(fix, finding) {
  const lines = [];
  lines.push(`${C.bgCyan}${C.bold} Apply Fix ${C.reset}`);
  lines.push('');
  lines.push(`${C.bold}File:${C.reset} ${C.cyan}${finding.file}${C.reset}`);
  lines.push(`${C.bold}Issue:${C.reset} ${finding.message}`);
  if (fix.reason) lines.push(`${C.bold}Reason:${C.reset} ${fix.reason}`);
  lines.push('');
  lines.push(`${C.dim}${'─'.repeat(60)}${C.reset}`);
  lines.push('');

  const oldLines = fix.oldCode.split('\n');
  const newLines = fix.newCode.split('\n');

  oldLines.forEach(l => lines.push(`${C.red}- ${l}${C.reset}`));
  lines.push('');
  newLines.forEach(l => lines.push(`${C.green}+ ${l}${C.reset}`));

  lines.push('');
  lines.push(`${C.dim}${'─'.repeat(60)}${C.reset}`);
  lines.push('');
  lines.push(`${C.bold}${C.green}[Y]${C.reset} Apply   ${C.bold}${C.red}[N]${C.reset} Cancel`);

  return lines.join('\n');
}

function renderMessage(text, color = C.cyan) {
  return `${color}${C.bold}${text}${C.reset}\n\n${C.dim}Press any key to continue...${C.reset}`;
}

export class SolutionsViewer {
  constructor(rawText, options = {}) {
    this.solutions = parseSolutions(rawText);
    this.findings = options.findings || [];
    this.projectRoot = options.projectRoot || process.cwd();
    this.aiConfig = options.aiConfig || null;
    this.index = 0;
    this.busy = false;
  }

  render() {
    const total = this.solutions.length;
    const cur = this.solutions[this.index];
    const sev = severityFromTitle(cur.title);
    const finding = this.findings[this.index];

    const lines = [];
    const header = ` Solutions  ${this.index + 1}/${total} `;
    lines.push(`${C.bgCyan}${C.bold}${header}${C.reset}`);
    lines.push('');

    lines.push(`${sev.color}${C.bold}● ${sev.label}${C.reset}  ${C.bold}${cur.title}${C.reset}`);
    if (finding) {
      lines.push(`${C.dim}  ${finding.file}${C.reset}`);
    }
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

    lines.push(this.renderProgress(total));
    lines.push('');

    const canApply = this.aiConfig && this.findings[this.index];
    const applyKey = canApply ? `  ${C.bold}${C.green}[A]${C.reset} Apply fix` : '';
    lines.push(`${C.bold}[←→]${C.reset} Navigate  ${C.bold}[N/P]${C.reset} Next/Prev${applyKey}  ${C.bold}[Q]${C.reset} Back`);

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

  showSpinner(message) {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    process.stdout.write(C.cursorHome + C.clearDown);
    const timer = setInterval(() => {
      process.stdout.write(`\r${C.cyan}${frames[i % frames.length]}${C.reset} ${message}`);
      i++;
    }, 80);
    return () => {
      clearInterval(timer);
      process.stdout.write('\r\x1b[2K');
    };
  }

  showStatus(text, color) {
    process.stdout.write(C.cursorHome + C.clearDown + renderMessage(text, color) + '\n');
    return new Promise(resolve => {
      const onKey = () => {
        process.stdin.removeListener('data', onKey);
        resolve();
      };
      process.stdin.once('data', onKey);
    });
  }

  async confirmDiff(fix, finding) {
    process.stdout.write(C.cursorHome + C.clearDown + renderDiff(fix, finding) + '\n');
    return new Promise(resolve => {
      const onKey = data => {
        const k = data.toString().toLowerCase();
        if (k === 'y') {
          process.stdin.removeListener('data', onKey);
          resolve(true);
        } else if (k === 'n' || k === '\x1b' || k === '\x03' || k === 'q') {
          process.stdin.removeListener('data', onKey);
          resolve(false);
        }
      };
      process.stdin.on('data', onKey);
    });
  }

  async handleApply() {
    if (this.busy) return;
    this.busy = true;

    const finding = this.findings[this.index];
    if (!finding) {
      await this.showStatus('No file linked to this solution', C.red);
      this.busy = false;
      this.render();
      return;
    }

    const stop = this.showSpinner(`Generating precise fix for ${finding.file}...`);
    const result = await generateFix(finding, this.projectRoot, this.aiConfig);
    stop();

    if (result.error) {
      await this.showStatus(`Cannot generate fix: ${result.error}`, C.red);
      this.busy = false;
      this.render();
      return;
    }

    const confirmed = await this.confirmDiff(result.fix, finding);
    if (!confirmed) {
      await this.showStatus('Cancelled — file not modified', C.yellow);
      this.busy = false;
      this.render();
      return;
    }

    try {
      const newContent = result.fileContent.replace(result.fix.oldCode, result.fix.newCode);
      writeFileSync(result.filePath, newContent, 'utf-8');
      await this.showStatus(`✓ Fix applied to ${finding.file}`, C.green);
      this.solutions.splice(this.index, 1);
      this.findings.splice(this.index, 1);
      if (this.solutions.length === 0) {
        this.busy = false;
        this._closeViewer();
        return;
      }
      if (this.index >= this.solutions.length) {
        this.index = this.solutions.length - 1;
      }
    } catch (e) {
      await this.showStatus(`Write failed: ${e.message}`, C.red);
    }

    this.busy = false;
    this.render();
  }

  _closeViewer() {
    if (this._onData) {
      process.stdin.removeListener('data', this._onData);
      this._onData = null;
    }
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    console.clear();
    if (this._resolve) {
      const r = this._resolve;
      this._resolve = null;
      r();
    }
  }

  async show() {
    if (this.solutions.length === 0) {
      console.log(`${C.dim}No solutions to display.${C.reset}`);
      return;
    }

    return new Promise(resolve => {
      this._resolve = resolve;
      console.clear();
      this.render();

      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }

      const onData = data => {
        if (this.busy) return;
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
        } else if (key === 'a' || key === 'A') {
          this.handleApply();
        } else if (key === 'q' || key === 'Q' || key === '\x1b' || key === '\x03' || key === '\r' || key === '\n') {
          this._closeViewer();
        }
      };

      this._onData = onData;
      process.stdin.on('data', onData);
    });
  }
}
