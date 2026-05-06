// NEXUS - AI-powered code review CLI
//
// Architecture (modular, like PRISM):
// src/
//   ├── check.js          Entry point (CLI orchestration)
//   ├── index.js          Module exports (this file)
//   ├── core/             Code analysis logic
//   │   ├── analyzer.js          Main analyzer (orchestrates analysis)
//   │   ├── git-detector.js      Git change detection
//   │   └── local-checks.js      Local linting/type checking
//   ├── ai/               AI provider integrations
//   │   └── provider.js          Multi-provider abstraction (Claude, OpenAI, Gemini)
//   ├── config/           Configuration & persistence
//   │   └── storage.js           Config file management
//   ├── tui/              Terminal UI
//   │   ├── menu.js              Menu components
//   │   └── renderer.js          Rendering utilities
//   └── utils/            Utilities (future)
//
// Pattern: Separation of concerns, reusable modules, clear responsibilities

export { CodeAnalyzer } from './core/analyzer.js';
export { GitDetector } from './core/git-detector.js';
export { LocalChecks } from './core/local-checks.js';
export { AIProvider } from './ai/provider.js';
export { Menu, Settings, ResultsMenu } from './tui/menu.js';
export { TUI } from './tui/renderer.js';
export * from './config/storage.js';
