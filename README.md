# NEXUS

AI-powered code review CLI. Analyze any code (TypeScript, JavaScript, Python, Go, Java, etc.) with Claude, OpenAI, or Gemini.

**No installation required.** Zero dependencies on target projects.

## What It Does

```
nexus
    ↓
Reads src/ files
    ↓
Runs local tools (ESLint, type checkers if available)
    ↓
Sends to Claude API for security/quality/architecture analysis
    ↓
Reports findings
    ↓
User decides next step
```

## Quick Start

### Install

```bash
npm install -g @walzate1/nexus
```

### Set API Key

```bash
# Choose your provider
export ANTHROPIC_API_KEY="sk-..."        # Claude
export OPENAI_API_KEY="sk-..."           # OpenAI
export GEMINI_API_KEY="AIza..."          # Google Gemini
```

### Run

```bash
cd /path/to/project
nexus
```

Output:
```
📋 Code Review Analysis

Project: /path/to/project
==================================================

Found 5 file(s)

🔍 Running ESLint...
📘 Running type checks...
🤖 Analyzing code with Claude...

==================================================
Findings
==================================================

🔐 SECURITY (2)
  - src/auth.ts:45 — SQL injection risk in query construction
  - src/db.ts:12 — No input validation before database call

📘 TYPE (1)
  - src/utils.ts:23 — Type 'unknown' needs explicit type assertion

✅ QUALITY (1)
  - src/component.ts:8 — Unused parameter 'props'

⚡ PERFORMANCE (1)
  - src/list.ts:50 — N+1 query pattern detected

==================================================
Total: 5 issue(s) found
```

## Installation

### Global (Recommended)

```bash
npm install -g @walzate1/nexus
```

Then use from any project:

```bash
nexus
```

### Ad-Hoc (without installation)

```bash
npx @walzate1/nexus
```

## Configuration

### API Key

NEXUS supports Claude, OpenAI, and Google Gemini. Set any or all:

```bash
# Environment variables
export ANTHROPIC_API_KEY="sk-..."    # Claude
export OPENAI_API_KEY="sk-..."       # OpenAI
export GEMINI_API_KEY="AIza..."      # Google Gemini

# Or in .env file
echo "ANTHROPIC_API_KEY=sk-..." > .env
echo "OPENAI_API_KEY=sk-..." >> .env
echo "GEMINI_API_KEY=AIza..." >> .env
source .env
```

Select your provider during setup in the interactive menu.

## How It Works

### 1. Local Analysis

Runs if tools are installed in your project:
- **ESLint** — Lint issues
- **Types** — Type checking errors

### 2. AI Analysis (Multi-Provider)

Sends code samples to Claude, OpenAI, or Gemini for:
- **Security** — SQL injection, XSS, auth flaws
- **Performance** — N+1 queries, memory leaks, loops
- **Architecture** — SOLID violations, patterns
- **Quality** — Complexity, duplication, readability
- **Testing** — Missing tests, coverage gaps

## Output

Text report with:
- **Type** — category (security, type, quality, etc)
- **Location** — file:line or file
- **Message** — description of finding
- **Severity** — error or warning

## Comparison with Git Hooks

| | NEXUS | Git Hooks (husky) |
|---|---|---|
| **Installation** | Global CLI | Project-specific |
| **Dependencies** | None in target project | Installs husky/lint-staged |
| **Analysis** | AI + local tools | Rules-based (ESLint, etc) |
| **When runs** | On demand | On every commit |
| **Scope** | Current project | Only staged files |
| **Use case** | Code review before commit | Automatic enforcement |

## Use Cases

### Pre-Commit Review

```bash
# Check code before committing
nexus

# If issues found, fix them
# Then commit
git add .
git commit -m "fix: resolve issues"
```

### PR Review

```bash
# Review changes before creating PR
git checkout feature-branch
nexus
```

### Code Audit

```bash
# Audit existing codebase
nexus
```

### Team Review

```bash
# Share findings with team
nexus > code-review.txt
cat code-review.txt
```

## Limitations

- **Max 10 files** analyzed per run (for API efficiency)
- **Max 5 files** sent to AI (to keep context window reasonable)
- **Read-only** — never modifies code
- **Requires API key** — need at least one provider key (Claude, OpenAI, or Gemini)

## Troubleshooting

### "API key not set"

Set at least one API key for your chosen provider:

```bash
# For Claude
export ANTHROPIC_API_KEY="sk-..."

# Or for OpenAI
export OPENAI_API_KEY="sk-..."

# Or for Google Gemini
export GEMINI_API_KEY="AIza..."

nexus
```

### "No code files found"

Ensure your project has a `src/` directory with code files (e.g., `.js`, `.ts`, `.py`, `.go`, etc.).

### "Lint/Type check errors but no output"

Install the tools your project uses:

```bash
# For JavaScript/TypeScript
npm install --save-dev eslint typescript

# Or for other languages, ensure their linters/type checkers are installed
```

Then run again:

```bash
nexus
```

### API Rate Limit

If you hit Claude API rate limits, wait and retry.

## API Usage

Each `nexus` call uses tokens from your chosen provider (Claude, OpenAI, or Gemini). Usage depends on:
- Number of files analyzed (max 5)
- Size of code (max ~2KB per file)

Typical cost: **< $0.01 per check** (varies by provider)

## Contributing

Issues/PRs: https://bitbucket.org/walzate1/nexus

## License

UNLICENSED — private package
