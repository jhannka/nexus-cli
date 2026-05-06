import { AIProvider } from '../ai/provider.js';
import { GitDetector } from './git-detector.js';
import { LocalChecks } from './local-checks.js';
import { getApiKeyForProvider } from '../config/storage.js';

export class CodeAnalyzer {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.git = new GitDetector(projectRoot);
    this.localChecks = new LocalChecks(projectRoot);
  }

  async analyze(config) {
    const files = this.git.getChangedFiles();

    if (files.length === 0) {
      console.log('⚠️  No code changes found in git');
      console.log('   (No staged/unstaged changes or new files)\n');
      return { files: [], findings: [] };
    }

    console.log(`Found ${files.length} changed file(s):\n`);
    files.forEach(f => console.log(`   ${f}`));
    console.log();

    const localFindings = this.localChecks.run(config);
    const aiFindings = await this.analyzeWithAI(files, config);

    const allFindings = [...localFindings, ...aiFindings];
    return { files, findings: allFindings };
  }

  async analyzeWithAI(files, config) {
    if (files.length === 0) return [];

    const provider = config.provider || 'anthropic';
    const apiKey = getApiKeyForProvider(provider);

    if (!apiKey) {
      console.log(`\n❌ No API key configured for ${provider}. Set one in Settings.`);
      return [];
    }

    console.log(`\n🤖 Analyzing code changes with ${provider}...`);

    const diffs = this.git.getChangeDiff(files.slice(0, config.maxFilesForClaude));
    const filesContext = Object.entries(diffs)
      .map(([file, diff]) => `\n## File: ${file}\n\`\`\`diff\n${diff}\n\`\`\``)
      .join('\n');

    if (!filesContext.trim()) {
      console.log('⚠️  No changes to analyze');
      return [];
    }

    const activeChecks = Object.entries(config.checks)
      .filter(([, enabled]) => enabled)
      .map(([name]) => name)
      .join(', ');

    const language = config.language || 'english';
    const languageInstructions = {
      english: 'Respond in English',
      spanish: 'Responde en español',
      french: 'Répondez en français',
      german: 'Antworte auf Deutsch'
    };

    const prompt = `${languageInstructions[language] || languageInstructions['english']}.

Review these code changes for issues in these areas: ${activeChecks}

${filesContext}

Focus on the changes shown in the diff. Format findings as:
- [TYPE] File:Line - Message

Be concise. Max 5 findings.`;

    const aiProvider = new AIProvider(provider, apiKey, config.models[provider]);
    const responseText = await aiProvider.analyze(prompt);

    return this.parseFindings(responseText);
  }

  parseFindings(responseText) {
    const findings = [];
    const lines = responseText.split('\n');

    lines.forEach(line => {
      const match = line.match(/\[(.*?)\]\s+(\S+):(\d+)\s*-\s*(.+)/);
      if (match) {
        findings.push({
          type: match[1].toLowerCase(),
          file: match[2],
          line: parseInt(match[3]),
          message: match[4],
          severity: match[1].toLowerCase() === 'error' ? 'error' : 'warning'
        });
      }
    });

    return findings;
  }

  async generateSolutions(findings, config) {
    const solutions = [];

    for (const finding of findings) {
      const provider = config.provider || 'anthropic';
      const apiKey = getApiKeyForProvider(provider);

      if (!apiKey) continue;

      const solutionPrompt = `Based on this code issue:
File: ${finding.file}
Issue: ${finding.message}

Provide a concise code solution or fix. Keep it under 100 words.`;

      try {
        const aiProvider = new AIProvider(provider, apiKey, config.models[provider]);
        const solution = await aiProvider.analyze(solutionPrompt);
        solutions.push({
          ...finding,
          solution
        });
      } catch (error) {
        solutions.push(finding);
      }
    }

    return solutions;
  }
}
