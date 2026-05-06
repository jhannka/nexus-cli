import { homedir } from 'os';
import { resolve, dirname } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { randomBytes } from 'crypto';

const configDir = resolve(homedir(), '.prism-check');
const configFile = resolve(configDir, 'config.json');

// Ensure config directory exists
if (!existsSync(configDir)) {
  mkdirSync(configDir, { recursive: true });
}

export function loadConfig() {
  if (!existsSync(configFile)) {
    return getDefaultConfig();
  }

  try {
    const content = readFileSync(configFile, 'utf-8');
    return JSON.parse(content);
  } catch {
    return getDefaultConfig();
  }
}

export function saveConfig(config) {
  writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf-8');
}

export function getDefaultConfig() {
  return {
    provider: 'anthropic',
    language: 'english',
    apiKeys: {
      anthropic: process.env.ANTHROPIC_API_KEY || '',
      openai: process.env.OPENAI_API_KEY || '',
      gemini: process.env.GEMINI_API_KEY || ''
    },
    models: {
      anthropic: 'claude-opus-4-7',
      openai: 'gpt-4',
      gemini: 'gemini-2.0-flash'
    },
    checks: {
      security: true,
      performance: true,
      architecture: true,
      quality: true,
      testing: true,
      lint: true,
      types: true
    },
    maxFiles: 10,
    maxFilesForClaude: 5,
    version: '1.0.0'
  };
}

export function setLanguage(language) {
  const config = loadConfig();
  config.language = language;
  saveConfig(config);
}

export function setChecks(checks) {
  const config = loadConfig();
  config.checks = { ...config.checks, ...checks };
  saveConfig(config);
}

export function setProvider(provider) {
  const config = loadConfig();
  config.provider = provider;
  saveConfig(config);
}

export function setApiKey(provider, apiKey) {
  const config = loadConfig();
  if (!config.apiKeys) config.apiKeys = {};
  config.apiKeys[provider] = apiKey;
  saveConfig(config);
}

export function getApiKeyForProvider(provider) {
  const config = loadConfig();
  return config.apiKeys?.[provider] || process.env[`${provider.toUpperCase()}_API_KEY`] || '';
}

export function setModelForProvider(provider, model) {
  const config = loadConfig();
  if (!config.models) config.models = {};
  config.models[provider] = model;
  saveConfig(config);
}
