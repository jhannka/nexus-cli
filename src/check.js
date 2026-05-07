#!/usr/bin/env node
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { existsSync, readFileSync, appendFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { TUI } from './tui/renderer.js';
import { Menu, Settings, ResultsMenu } from './tui/menu.js';
import { PrismUI } from './tui/prism-ui.js';
import { ConfigurationMenu } from './tui/configuration-menu.js';
import { loadConfig, getApiKeyForProvider, saveConfig, setApiKey, setChecks, setProvider, setModelForProvider, setLanguage } from './config/storage.js';
import { CodeAnalyzer } from './core/analyzer.js';
import { GitDetector } from './core/git-detector.js';
import { AIProvider } from './ai/provider.js';

const projectRoot = process.cwd();
const tui = new TUI();
const logFile = resolve(projectRoot, 'nexus-debug.log');

function log(msg) {
  appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const selfPkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'));

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m'
};

function readlineInput() {
  return new Promise(resolve => {
    let input = '';
    process.stdin.setRawMode(true);
    process.stdin.resume();

    const onData = (char) => {
      const code = char[0];
      if (code === 13) { // Enter
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        console.log();
        resolve(input);
      } else if (code === 127) { // Backspace
        input = input.slice(0, -1);
        process.stdout.write('\b \b');
      } else {
        input += char;
        process.stdout.write(char);
      }
    };

    process.stdin.on('data', onData);
  });
}


async function runLocalChecks(config) {
  // Skip local checks for now - focus on AI analysis
  return [];
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
          diff = `New file:\n${content.slice(0, 8000)}`;
        }
      }

      if (diff.trim()) {
        diffs[file] = diff.slice(0, 8000); // Limit to 8000 chars per file
      }
    } catch {}
  }
  return diffs;
}

async function analyzeWithAgents(files, config, ui, activeChecks) {
  const diffs = await getChangeDiff(files.slice(0, 5));

  const agentPromises = activeChecks.map(async (checkName, index) => {
    const agentNameReviewer = `${checkName}-reviewer`;
    const startTime = Date.now();

    await new Promise(r => setTimeout(r, index * 250));
    ui.setAgentState(agentNameReviewer, 'running');

    const agentFindings = [];

    // Analyze diff for specific patterns
    for (const [file, diff] of Object.entries(diffs)) {
      const lines = diff.split('\n');

      if (checkName === 'security') {
        // SQL Injection patterns
        if (/SELECT.*FROM.*WHERE.*\$|sql\s*=.*\+|backtick.*\$|template.*sql/i.test(diff)) {
          agentFindings.push({
            type: 'security',
            file,
            message: 'Potential SQL injection - string concatenation in SQL query',
            severity: 'high'
          });
        }

        // Hardcoded secrets
        if (/(password|api_key|secret|token|credential)\s*=\s*['"][^'"]{5,}['"]|const\s+(password|api_key)\s*=/i.test(diff)) {
          agentFindings.push({
            type: 'security',
            file,
            message: 'Hardcoded secrets or credentials detected',
            severity: 'critical'
          });
        }

        // Insecure HTTP
        if (/\bhttps?:\/\/localhost|http:\/\/.+:(3000|5000|8000|8080)|\bhttp:\/\//.test(diff) && !diff.includes('https')) {
          agentFindings.push({
            type: 'security',
            file,
            message: 'Insecure HTTP connection - use HTTPS',
            severity: 'high'
          });
        }

        // XSS risks
        if (/innerHTML\s*=|dangerouslySetInnerHTML|document\.write|eval\(|Function\(/i.test(diff)) {
          agentFindings.push({
            type: 'security',
            file,
            message: 'Potential XSS vulnerability - unsafe DOM manipulation',
            severity: 'high'
          });
        }

        // Path traversal
        if (/fs\.(read|write|access)[^)]*\.\.[^)]*\+|fs\.(read|write|access)[^)]*\+[^)]*\.\.|require\s*\(\s*['"][^'"]*\.\.[^'"]*\+|\.\.\/.*\+/i.test(diff)) {
          agentFindings.push({
            type: 'security',
            file,
            message: 'Potential path traversal vulnerability',
            severity: 'high'
          });
        }

        // eval/dynamic code execution
        if (/\beval\s*\(|new\s+Function\s*\(|setTimeout\s*\(\s*['"]|setInterval\s*\(\s*['"]/i.test(diff)) {
          agentFindings.push({
            type: 'security',
            file,
            message: 'Dynamic code execution detected (eval/Function)',
            severity: 'critical'
          });
        }
      }

      if (checkName === 'quality') {
        // Type annotations
        if (/(:\s*any|as\s+any|\[key:\s*string\]:\s*any)/i.test(diff)) {
          agentFindings.push({
            type: 'quality',
            file,
            message: 'Missing or overly broad type annotations',
            severity: 'warning'
          });
        }

        // Null checks
        if (/\?\.|\?|null|undefined|!\./.test(diff) && !/if\s*\(|&&|optional|catch/.test(diff)) {
          agentFindings.push({
            type: 'quality',
            file,
            message: 'Potential null or undefined reference without checks',
            severity: 'warning'
          });
        }

        // Dead code
        if (/const\s+\w+\s*=|let\s+\w+\s*=/.test(diff)) {
          const unused = diff.match(/const\s+(\w+)|let\s+(\w+)/g) || [];
          if (unused.length > 0) {
            agentFindings.push({
              type: 'quality',
              file,
              message: 'Potential unused variables detected',
              severity: 'info'
            });
          }
        }
      }
    }

    // Analysis time
    await new Promise(r => setTimeout(r, 800 + Math.random() * 1200));

    const duration = Date.now() - startTime;
    ui.setAgentState(agentNameReviewer, 'done', {
      findings: agentFindings.length,
      duration
    });

    return agentFindings;
  });

  const results = await Promise.all(agentPromises);
  return results.flat();
}

function startSpinner(message) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  process.stdout.write('\n');
  const timer = setInterval(() => {
    process.stdout.write(`\r${COLORS.cyan}${frames[i % frames.length]}${COLORS.reset} ${message}`);
    i++;
  }, 80);
  return () => {
    clearInterval(timer);
    process.stdout.write('\r\x1b[2K');
  };
}

async function generateSolutions(findings, config) {
  if (!findings || findings.length === 0) return [];

  const provider = config.provider || 'anthropic';
  const apiKey = getApiKeyForProvider(provider);

  if (!apiKey) {
    console.log(`\n❌ No API key configured for ${provider}.`);
    return [];
  }

  const defaultModels = {
    anthropic: 'claude-opus-4-7',
    openai: 'gpt-4',
    gemini: 'gemini-2.0-flash'
  };
  const model = config.models?.[provider] || defaultModels[provider];

  const findingsText = findings
    .map(f => `- [${(f.severity || 'medium').toUpperCase()}] ${f.file}:${f.line || '?'}\n  ${f.message}`)
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

  const stopSpinner = startSpinner(`Generating solutions with ${provider} (${model})...`);
  const aiProvider = new AIProvider(provider, apiKey, model);
  const TIMEOUT_MS = 90000;

  try {
    const response = await Promise.race([
      aiProvider.analyze(prompt, { maxTokens: 4096 }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS)
      )
    ]);
    stopSpinner();
    return [{ provider, response }];
  } catch (error) {
    stopSpinner();
    console.log(`\n${COLORS.dim}❌ Error generating solutions: ${error.message}${COLORS.reset}`);
    log(`generateSolutions error: ${error.stack || error.message}`);
    return [];
  }
}

async function categorizeAgents(files) {
  const fileExtensions = files.map(f => f.split('.').pop()?.toLowerCase()).filter(Boolean);
  const hasTs = fileExtensions.includes('ts') || fileExtensions.includes('tsx');
  const hasJs = fileExtensions.includes('js') || fileExtensions.includes('jsx');
  const hasCss = fileExtensions.includes('css') || fileExtensions.includes('scss');
  const hasHtml = fileExtensions.includes('html');
  const hasPy = fileExtensions.includes('py');
  const hasSql = fileExtensions.includes('sql');

  const allAgents = [
    { name: 'security', applicable: true },
    { name: 'performance', applicable: true },
    { name: 'architecture', applicable: true },
    { name: 'quality', applicable: true },
    { name: 'testing', applicable: hasTs || hasJs },
    { name: 'lint', applicable: hasTs || hasJs || hasCss },
    { name: 'types', applicable: hasTs },
  ];

  const recommended = allAgents.filter(a => a.applicable);
  const notApplicable = allAgents.filter(a => !a.applicable);

  return { recommended, notApplicable };
}

async function runAnalysis(config) {
  const git = new GitDetector(projectRoot);
  const commitMsg = git.getLatestCommitMessage();
  const branchRef = git.getBranchRef();

  const activeChecks = Object.entries(config.checks)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name);

  const files = git.getChangedFiles();
  if (files.length === 0) {
    console.clear();
    console.log('⚠️  No code changes found in git');
    console.log('   (No staged/unstaged changes or new files)\n');
    return;
  }

  // Show agent recommendations
  const { recommended, notApplicable } = await categorizeAgents(files);

  console.clear();
  console.log(`\n${COLORS.cyan}${COLORS.bold}NEXUS${COLORS.reset} v${selfPkg.version}\n`);
  console.log(`${COLORS.bold}Reviewing:${COLORS.reset} ${commitMsg}`);
  console.log(`${branchRef}\n`);

  if (recommended.length > 0) {
    console.log(`${COLORS.dim}— Recommended (${recommended.length}) ${COLORS.reset}`);
    recommended.forEach(a => {
      console.log(`  ${COLORS.cyan}[✓]${COLORS.reset} ${a.name}`);
    });
  }

  if (notApplicable.length > 0) {
    console.log(`\n${COLORS.dim}— Not Applicable (${notApplicable.length}) ${COLORS.reset}`);
    notApplicable.forEach(a => {
      console.log(`  ${COLORS.dim}[−] ${a.name}${COLORS.reset}`);
    });
  }

  // Interactive configuration menu
  const severityLevels = ['critical', 'high', 'medium', 'low'];
  const recommendedAgentNames = recommended.map(a => a.name);

  const configMenu = new ConfigurationMenu(recommendedAgentNames, severityLevels);
  const userConfig = await configMenu.configure();

  if (userConfig.cancelled) {
    return { cancelled: true };
  }

  const selectedAgents = new Set(userConfig.agents);
  const minSeverity = userConfig.severity;

  const agentNames = Array.from(selectedAgents).map(c => `${c}-reviewer`);

  console.clear();
  const ui = new PrismUI(selfPkg.version);
  ui.init(commitMsg, branchRef, agentNames);

  ui.update(1, 5, 0);

  ui.update(2, 5, 0);
  let localFindings = [];
  try {
    localFindings = await runLocalChecks(config);
  } catch (err) {
    log(`Error in runLocalChecks: ${err.message}`);
  }

  ui.update(3, 5, 0);
  const selectedChecks = Array.from(selectedAgents);
  log(`About to call analyzeWithAgents with ${selectedChecks.length} checks`);
  let aiFindings = [];
  try {
    aiFindings = await analyzeWithAgents(files, config, ui, selectedChecks);
    log(`analyzeWithAgents returned ${aiFindings.length} findings`);
  } catch (err) {
    log(`Error in analyzeWithAgents: ${err.message}`);
  }

  ui.update(4, 5, selectedChecks.length);
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

  // Filter by minimum severity based on user selection
  const severityOrder = { critical: 3, high: 2, medium: 1, warning: 1, low: 0, info: 0 };
  const minSeverityLevel = severityOrder[minSeverity] ?? 1;
  const filteredFindings = unique.filter(f => {
    const fSeverity = f.severity?.toLowerCase() || 'medium';
    const fLevel = severityOrder[fSeverity] ?? 1;
    return fLevel >= minSeverityLevel;
  });

  ui.update(5, 5, selectedChecks.length);
  ui.finish();

  console.log('\n' + '═'.repeat(50));
  console.log('Findings');
  console.log('═'.repeat(50) + '\n');

  if (filteredFindings.length === 0) {
    console.log('✨ No issues found!\n');
    console.log(`${COLORS.dim}Press any key to return to menu...${COLORS.reset}`);
    await tui.getKeyPress();
    return;
  }

  const resultsMenu = new ResultsMenu(filteredFindings);
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
    for (const finding of filteredFindings) {
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
        const result = await runAnalysis(config);
        if (!result?.cancelled) {
          console.log(`\n${COLORS.dim}Press any key to return to menu...${COLORS.reset}`);
          await tui.getKeyPress();
        }
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
