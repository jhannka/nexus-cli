#!/usr/bin/env node
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { TUI } from './tui/renderer.js';
import { Menu, Settings, ResultsMenu } from './tui/menu.js';
import { PrismUI } from './tui/prism-ui.js';
import { loadConfig, getApiKeyForProvider, saveConfig, setApiKey, setChecks, setProvider, setModelForProvider, setLanguage } from './config/storage.js';
import { CodeAnalyzer } from './core/analyzer.js';
import { GitDetector } from './core/git-detector.js';
import { AIProvider } from './ai/provider.js';

const projectRoot = process.cwd();
const tui = new TUI();

const __dirname = dirname(fileURLToPath(import.meta.url));
const selfPkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'));

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m'
};


async function runLocalChecks(config) {
  const findings = [];
  const packageJsonPath = resolve(projectRoot, 'package.json');

  if (!existsSync(packageJsonPath)) return findings;

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

  if (config.checks.lint && (packageJson.devDependencies?.eslint || packageJson.dependencies?.eslint)) {
    try {
      execSync('npx eslint src/ --format json', {
        stdio: 'pipe',
        cwd: projectRoot
      });
    } catch (error) {
      const output = error.stdout?.toString() || '[]';
      try {
        const eslintFindings = JSON.parse(output);
        eslintFindings.forEach(file => {
          file.messages.forEach(msg => {
            findings.push({
              type: 'lint',
              file: file.filePath,
              line: msg.line,
              message: msg.message,
              severity: msg.severity === 2 ? 'error' : 'warning'
            });
          });
        });
      } catch {}
    }
  }

  if (config.checks.types && (packageJson.devDependencies?.typescript || packageJson.dependencies?.typescript)) {
    try {
      execSync('npx tsc --noEmit', { stdio: 'pipe', cwd: projectRoot });
    } catch (error) {
      const output = error.stderr?.toString() || error.stdout?.toString() || '';
      const typeErrors = output.match(/error TS\d+:/g) || [];
      if (typeErrors.length > 0) {
        findings.push({
          type: 'types',
          message: `Found ${typeErrors.length} type errors`,
          severity: 'error'
        });
      }
    }
  }

  return findings;
}

async function getAvailableModels(provider, apiKey) {
  if (!apiKey) {
    // No API key, return defaults
    const defaults = {
      anthropic: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
      openai: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
      gemini: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash']
    };
    return defaults[provider] || [];
  }

  try {
    if (provider === 'anthropic') {
      const client = new Anthropic({ apiKey });
      // Test API key by making a quick call
      await client.messages.create({
        model: 'claude-opus-4-7',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }]
      });
      return ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'];
    } else if (provider === 'openai') {
      try {
        const { default: OpenAI } = await import('openai');
        const openai = new OpenAI({ apiKey });
        await openai.models.list();
        return ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'];
      } catch {
        return ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'];
      }
    } else if (provider === 'gemini') {
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);
        genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        return ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'];
      } catch {
        return ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'];
      }
    }
  } catch (error) {
    // API key invalid or API unreachable, return defaults
    const defaults = {
      anthropic: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
      openai: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
      gemini: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash']
    };
    return defaults[provider] || [];
  }
}

async function getChangeDiff(files) {
  const diffs = {};
  for (const file of files) {
    try {
      // Try to get staged diff first
      let diff = '';
      try {
        diff = execSync(`git diff --cached "${file}"`, {
          cwd: projectRoot,
          encoding: 'utf-8'
        });
      } catch {
        // If not staged, get unstaged diff
        try {
          diff = execSync(`git diff "${file}"`, {
            cwd: projectRoot,
            encoding: 'utf-8'
          });
        } catch {
          // If not in git, get full file content
          const content = readFileSync(resolve(projectRoot, file), 'utf-8');
          diff = `New file:\n${content.slice(0, 1000)}`;
        }
      }

      if (diff.trim()) {
        diffs[file] = diff.slice(0, 1000); // Limit to 1000 chars per file
      }
    } catch {}
  }
  return diffs;
}

async function analyzeWithAgents(files, config, ui, activeChecks) {
  if (files.length === 0) return [];

  const provider = config.provider || 'anthropic';
  const apiKey = getApiKeyForProvider(provider);

  if (!apiKey) {
    ui.finish();
    console.log(`\n❌ No API key configured for ${provider}. Set one in Settings.`);
    return [];
  }

  const diffs = await getChangeDiff(files.slice(0, config.maxFilesForClaude));

  const filesContext = Object.entries(diffs)
    .map(([file, diff]) => `\n## File: ${file}\n\`\`\`diff\n${diff}\n\`\`\``)
    .join('\n');

  if (!filesContext.trim()) {
    ui.finish();
    console.log('⚠️  No changes to analyze');
    return [];
  }

  const language = config.language || 'english';
  const languageInstructions = {
    english: 'Respond in English',
    spanish: 'Responde en español',
    french: 'Répondez en français',
    german: 'Antworte auf Deutsch'
  };

  const model = config.models?.[provider] || 'claude-opus-4-7';
  const aiProvider = new AIProvider(provider, apiKey, model);

  const agentPromises = activeChecks.map(async (checkName) => {
    ui.setAgentState(`${checkName}-reviewer`, 'running');

    const checkType = checkName.charAt(0).toUpperCase() + checkName.slice(1);
    const prompt = `${languageInstructions[language] || languageInstructions['english']}.

Review these code changes ONLY for ${checkType} issues.

${filesContext}

Focus on ${checkType.toLowerCase()} problems. Format findings as:
- [${checkType.toUpperCase()}] File:Line - Message

Max 3 findings.`;

    try {
      const responseText = await aiProvider.analyze(prompt);
      const findings = [];
      const lines = responseText.split('\n');

      for (const line of lines) {
        const match = line.match(/^\s*-\s*\[(\w+)\]\s+(\S+):?(\d+)?\s*-\s*(.+)/);
        if (match) {
          const [, type, file, lineNum, message] = match;
          findings.push({
            type: type.toLowerCase(),
            file,
            line: lineNum ? parseInt(lineNum) : undefined,
            message,
            severity: type === 'SECURITY' ? 'error' : 'warning'
          });
        }
      }

      ui.setAgentState(`${checkName}-reviewer`, 'done');
      return findings;
    } catch (err) {
      ui.setAgentState(`${checkName}-reviewer`, 'failed');
      return [];
    }
  });

  const results = await Promise.all(agentPromises);
  return results.flat();
}

async function generateSolutions(findings, config) {
  if (!findings || findings.length === 0) return [];

  const provider = config.provider || 'anthropic';
  const apiKey = getApiKeyForProvider(provider);

  if (!apiKey) {
    console.log(`\n❌ No API key configured for ${provider}.`);
    return [];
  }

  console.log(`\n🔧 Generating solutions with ${provider}...\n`);

  const findingsText = findings
    .map(f => `- [${f.severity.toUpperCase()}] ${f.file}:${f.line || '?'}\n  ${f.message}`)
    .join('\n');

  const language = config.language || 'english';
  const languageInstructions = {
    english: 'Respond in English',
    spanish: 'Responde en español',
    french: 'Répondez en français',
    german: 'Antworte auf Deutsch'
  };

  const prompt = `${languageInstructions[language] || languageInstructions['english']}.

You are a code review expert. Generate practical solutions for these code issues:

${findingsText}

For each issue:
1. Explain why it's a problem
2. Show the correct code
3. Format as:
   ## Issue: [file:line] - [type]
   **Problem**: explanation
   **Solution**:
   \`\`\`typescript
   correct code here
   \`\`\``;

  try {
    if (provider === 'anthropic') {
      const client = new Anthropic({ apiKey });
      const model = config.models?.anthropic || 'claude-opus-4-7';
      const message = await client.messages.create({
        model,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }]
      });
      return [{ provider, response: message.content[0]?.text || '' }];
    } else if (provider === 'openai') {
      try {
        const { default: OpenAI } = await import('openai');
        const openai = new OpenAI({ apiKey });
        const model = config.models?.openai || 'gpt-4';
        const message = await openai.chat.completions.create({
          model,
          max_tokens: 2048,
          messages: [{ role: 'user', content: prompt }]
        });
        return [{ provider, response: message.choices[0]?.message?.content || '' }];
      } catch {
        console.log('⚠️  OpenAI SDK not available');
        return [];
      }
    } else if (provider === 'gemini') {
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = config.models?.gemini || 'gemini-2.0-flash';
        const generativeModel = genAI.getGenerativeModel({ model });
        const response = await generativeModel.generateContent(prompt);
        return [{ provider, response: response.response.text() }];
      } catch {
        console.log('⚠️  Gemini SDK not available');
        return [];
      }
    }
  } catch (error) {
    console.log(`\n❌ Error generating solutions: ${error.message}`);
    return [];
  }
}

async function runAnalysis(config) {
  const git = new GitDetector(projectRoot);
  const commitMsg = git.getLatestCommitMessage();
  const branchRef = git.getBranchRef();

  const activeChecks = Object.entries(config.checks)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name);
  const agentNames = activeChecks.map(c => `${c}-reviewer`);

  console.clear();
  const ui = new PrismUI(selfPkg.version);
  ui.init(commitMsg, branchRef, agentNames);

  ui.update(1, 5, 0);
  const files = await getChangedFiles();
  if (files.length === 0) {
    ui.finish();
    console.log('⚠️  No code changes found in git');
    console.log('   (No staged/unstaged changes or new files)\n');
    console.log(`${COLORS.dim}Press any key to return to menu...${COLORS.reset}`);
    await tui.getKeyPress();
    return;
  }

  ui.update(2, 5, 0);
  const localFindings = await runLocalChecks(config);

  ui.update(3, 5, 0);
  const aiFindings = await analyzeWithAgents(files, config, ui, activeChecks);

  ui.update(4, 5, activeChecks.length);
  const allFindings = [...localFindings, ...aiFindings];
  const unique = [];
  const seen = new Set();

  for (const finding of allFindings) {
    const key = `${finding.type}:${finding.file}:${finding.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(finding);
    }
  }

  ui.update(5, 5, activeChecks.length);
  ui.finish();

  console.log('\n' + '═'.repeat(50));
  console.log('Findings');
  console.log('═'.repeat(50) + '\n');

  if (unique.length === 0) {
    console.log('✨ No issues found!\n');
    console.log(`${COLORS.dim}Press any key to return to menu...${COLORS.reset}`);
    await tui.getKeyPress();
    return;
  }

  const resultsMenu = new ResultsMenu(unique);
  const selectedFindings = await resultsMenu.selectAndSolve();

  if (selectedFindings && selectedFindings.length > 0) {
    console.log(`\n✅ Selected ${selectedFindings.length} issue(s) for solution\n`);
    const solutions = await generateSolutions(selectedFindings, config);

    if (solutions && solutions.length > 0) {
      console.log('\n' + '═'.repeat(50));
      console.log('Recommended Solutions');
      console.log('═'.repeat(50) + '\n');

      for (const solution of solutions) {
        console.log(solution.response);
        console.log('\n' + '─'.repeat(50) + '\n');
      }
    }
  } else {
    const byType = {};
    for (const finding of unique) {
      const type = finding.type || 'other';
      if (!byType[type]) byType[type] = [];
      byType[type].push(finding);
    }

    const emoji = {
      lint: '🔍',
      types: '📘',
      security: '🔐',
      performance: '⚡',
      architecture: '🏗️',
      quality: '✅',
      testing: '✔️'
    };

    console.log('Summary:\n');
    for (const [type, findings] of Object.entries(byType)) {
      console.log(`${emoji[type] || '•'} ${type.toUpperCase()} (${findings.length})`);
    }

    console.log('\n' + '═'.repeat(50));
    console.log(`Total: ${unique.length} issue(s) found\n`);
  }

  console.log(`${COLORS.dim}Press any key to return to menu...${COLORS.reset}`);
  await tui.getKeyPress();
}

async function openSettings() {
  const config = loadConfig();
  const providers = ['anthropic', 'openai', 'gemini'];
  const languages = ['english', 'spanish', 'french', 'german'];
  const providerLabels = { anthropic: 'Claude (Anthropic)', openai: 'OpenAI', gemini: 'Google Gemini' };
  const languageLabels = { english: 'English', spanish: 'Español', french: 'Français', german: 'Deutsch' };

  const modelLabels = {
    'claude-opus-4-7': 'Opus', 'claude-sonnet-4-6': 'Sonnet', 'claude-haiku-4-5-20251001': 'Haiku',
    'gpt-4': 'GPT-4', 'gpt-4-turbo': 'GPT-4 Turbo', 'gpt-3.5-turbo': 'GPT-3.5',
    'gemini-2.0-flash': 'Gemini 2.0 Flash', 'gemini-1.5-pro': 'Gemini 1.5 Pro', 'gemini-1.5-flash': 'Gemini 1.5 Flash'
  };

  const currentProvider = config.provider || 'anthropic';
  const currentLanguage = config.language || 'english';

  // Pre-load available models for each provider
  const availableModelsByProvider = {};
  for (const provider of providers) {
    const apiKey = getApiKeyForProvider(provider);
    availableModelsByProvider[provider] = await getAvailableModels(provider, apiKey);
  }

  const currentApiKey = getApiKeyForProvider(currentProvider);
  const availableModels = availableModelsByProvider[currentProvider];
  const currentModel = config.models?.[currentProvider] || availableModels[0];

  const settings = [
    // Model & Provider Section
    { name: 'Provider', key: 'provider', options: providers, display: (v) => providerLabels[v] || v },
    {
      name: 'Model',
      key: 'model',
      options: availableModels,
      display: (v) => modelLabels[v] || v
    },
    {
      name: 'API Key',
      key: 'apiKey',
      display: (v) => v ? '✓ Set' : '✗ Not set',
      special: true
    },
    // Separator
    { separator: true },
    // Language Section
    { name: 'Language', key: 'language', options: languages, display: (v) => languageLabels[v] || v },
    // Separator
    { separator: true },
    // Tests & Checks Section
    ...Object.keys(config.checks).map(check => ({
      name: `${check.charAt(0).toUpperCase() + check.slice(1)}`,
      key: `check_${check}`,
      options: [true, false],
      display: (v) => v ? '✓ Enabled' : '✗ Disabled'
    }))
  ];

  const settingsValues = {
    provider: currentProvider,
    model: currentModel,
    language: currentLanguage,
    apiKey: currentApiKey,
    ...Object.fromEntries(Object.keys(config.checks).map(c => [`check_${c}`, config.checks[c]]))
  };

  const settingsScreen = new Settings(settings);
  settingsScreen.values = settingsValues;

  // Handle dynamic provider changes
  settingsScreen.onUpdate = (key, value) => {
    if (key === 'provider') {
      const modelSetting = settings[1]; // Model is always index 1
      const newModels = availableModelsByProvider[value];

      // Update model options based on available models for provider
      modelSetting.options = newModels;
      // Reset model to first option of new provider
      settingsScreen.values.model = newModels[0];
      // Update API key status for new provider
      settingsScreen.values.apiKey = getApiKeyForProvider(value);
    }
  };

  // Handle API Key editing
  settingsScreen.onEdit = async (key, fieldName) => {
    if (key === 'apiKey') {
      const provider = settingsScreen.values.provider;
      console.clear();
      console.log(`\n🔑 ${fieldName} for ${providerLabels[provider]}\n`);
      console.log('Enter your API key:');
      console.log('(input will be hidden)\n');

      return new Promise(resolve => {
        process.stdout.write('  > ');

        if (process.stdin.isTTY) {
          process.stdin.setRawMode(true);
        }

        let input = '';
        const onData = data => {
          const char = data.toString();

          if (char === '\x03') { // Ctrl+C
            process.stdout.write('\n');
            process.exit();
          }

          if (char === '\r' || char === '\n') {
            process.stdout.write('\n');
            process.stdin.removeListener('data', onData);
            if (process.stdin.isTTY) {
              process.stdin.setRawMode(false);
            }

            // Save the API key and set as active provider
            if (input.trim()) {
              setApiKey(provider, input.trim());
              setProvider(provider); // Make this the active provider
              console.log(`✅ API key saved for ${provider}\n`);
              console.log(`✅ ${provider} set as active provider\n`);
              resolve(`✓ Set`);
            } else {
              console.log('⚠️  No key entered\n');
              resolve(getApiKeyForProvider(provider) ? `✓ Set` : `✗ Not set`);
            }
          } else if (char === '\x7f') { // Backspace
            input = input.slice(0, -1);
            process.stdout.write('\b \b');
          } else if (char !== '\x1b') { // Ignore escape sequences
            input += char;
            process.stdout.write('*');
          }
        };

        process.stdin.on('data', onData);
      });
    }
    return undefined;
  };

  const result = await settingsScreen.edit();

  if (result) {
    let changed = false;
    const updatedConfig = loadConfig(); // Reload to check what was actually saved

    // Handle provider change
    if (result.provider && result.provider !== currentProvider) {
      setProvider(result.provider);
      changed = true;
    }

    // Handle language change
    if (result.language && result.language !== currentLanguage) {
      setLanguage(result.language);
      changed = true;
    }

    // Handle model change
    if (result.model && result.model !== currentModel) {
      setModelForProvider(result.provider || currentProvider, result.model);
      changed = true;
    }

    // Handle checks updates
    const updatedChecks = {};
    let checksChanged = false;
    Object.keys(config.checks).forEach(check => {
      const newVal = result[`check_${check}`];
      if (newVal !== undefined) {
        updatedChecks[check] = newVal;
        if (newVal !== config.checks[check]) checksChanged = true;
      }
    });

    if (checksChanged) {
      setChecks(updatedChecks);
      changed = true;
    }

    // Check if API key was actually saved (by onEdit callback)
    const savedApiKey = getApiKeyForProvider(result.provider || currentProvider);
    if (savedApiKey) {
      console.log('\n✅ Settings saved');
      if (!changed && savedApiKey !== currentApiKey) {
        console.log('   API key updated for', result.provider || currentProvider);
      }
      changed = true;
    } else if (changed) {
      console.log('\n✅ Settings saved');
    } else {
      console.log('\n⚪ No changes made');
    }
    console.log(`\n${COLORS.dim}Press any key to return to menu...${COLORS.reset}`);
    await tui.getKeyPress();
  }
}

async function main() {
  const mainMenu = new Menu([
    { key: 'analyze', label: '▶️  Run Code Analysis', sublabel: 'Start analyzing the project' },
    { key: 'settings', label: '⚙️  Settings', sublabel: 'Configure model, checks, API key' },
    { key: 'quit', label: '❌ Quit', sublabel: 'Exit NEXUS' }
  ]);

  while (true) {
    const selected = await mainMenu.select();
    const key = selected.key;

    switch (key) {
      case 'analyze': {
        console.clear();
        const config = loadConfig();
        const provider = config.provider || 'anthropic';
        const apiKey = getApiKeyForProvider(provider);
        if (!apiKey) {
          console.log(`\n❌ API key not configured for ${provider}. Go to Settings to add it.\n`);
          console.log(`${COLORS.dim}Press any key to return to menu...${COLORS.reset}`);
          await tui.getKeyPress();
          break;
        }
        await runAnalysis(config);
        console.log(`\n${COLORS.dim}Press any key to return to menu...${COLORS.reset}`);
        await tui.getKeyPress();
        break;
      }

      case 'settings': {
        console.clear();
        await openSettings();
        break;
      }

      case 'quit':
        console.clear();
        console.log('👋 Goodbye!\n');
        process.exit(0);
    }
  }
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
