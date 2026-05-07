# NEXUS

```
███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝
```

**AI-Powered Code Review** — Interactive terminal UI for reviewing code changes with Claude, OpenAI, or Gemini.

Pattern-based static analysis + AI-generated solutions + one-keystroke apply-to-file. Zero dependencies in target projects.

---

## Features

- **Interactive TUI** — full ASCII logo, dynamic progress bar, per-agent status (pending → running → done)
- **Multi-provider AI** — Anthropic Claude, OpenAI, Google Gemini (live model list per API key)
- **Pre-flight configuration** — toggle agents on/off, pick minimum severity threshold before run
- **Pattern detection** — SQL injection, hardcoded secrets, XSS, eval/dynamic code, path traversal, insecure HTTP, missing types, null/undefined refs
- **Parallel agent execution** — each agent runs independently with live progress counter
- **Severity filtering** — critical / high / medium / low; filters findings to user threshold
- **Interactive findings list** — multi-select issues with checkbox UI
- **AI solution viewer** — per-issue navigation, syntax-highlighted code blocks, color-coded severity badges
- **Apply fix to file** — AI generates structured `{oldCode, newCode}` patch, diff preview, Y/N confirm, write to disk
- **Auto-remove solved** — applied fixes splice out of viewer; closes when list empties
- **Persistent settings** — provider, model, language, agent toggles saved between runs
- **Localized output** — English, Spanish, French, German

---

## Quick Start

### Install

```bash
npm install -g nexus-cli
```

Or run ad-hoc:

```bash
npx nexus-cli
```

### Configure API Key

Run `nexus`, navigate to **Settings**, select provider, enter API key.

Or set via environment variable:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."     # Claude
export OPENAI_API_KEY="sk-..."            # OpenAI
export GEMINI_API_KEY="AIza..."           # Google Gemini
```

### Run

```bash
cd /path/to/project
nexus
```

---

## Workflow

### 1. Main Menu

```
███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
...
                                       v0.1.0
            AI-Powered Code Review
─────────────────────────────────────────

 ▶ ▶️  Run Code Analysis
     Start analyzing the project

   ⚙️  Settings
     Configure model, checks, API key

   ❌ Quit

[↑↓] Navigate  [Enter] Select  [Q] Quit
```

### 2. Configuration

Pick which agents to run and the minimum severity to display. Recommended agents auto-selected based on file types in your changes.

```
NEXUS Configuration

Select agents:
  ☑ security
  ☑ quality
  ☑ performance
  ☑ architecture
  ☐ testing

Minimum Severity:
  ◯ critical
  ◯ high
  ◉ medium
  ◯ low

[↑↓] Navigate  [Space] Toggle  [Enter] Start  [Q] Quit
```

### 3. Live Analysis

Each agent runs in parallel. UI updates in-place as agents transition through states.

```
» Step 3/5: Running 7 agents...
[████████████░░░░░░░░] 60%

Agents (4/7 complete):
  ✓ security-reviewer    3 findings · 1.2s
  ✓ quality-reviewer     2 findings · 0.9s
  ✓ performance-reviewer 0 findings · 0.7s
  ✓ architecture-reviewer 1 finding · 1.4s
  ⟳ testing-reviewer     analyzing...
  ⟳ lint-reviewer        analyzing...
  ⟳ types-reviewer       analyzing...
```

### 4. Results

Multi-select findings with checkboxes. Press `S` to generate solutions for selected items.

```
Code Review Results

Found 8 issue(s)

✓ [CRITICAL] src/app/auth.service.ts:?
   Hardcoded secrets or credentials detected

✓ [HIGH] src/app/auth.service.ts:?
   Potential SQL injection - string concatenation in SQL query

  [HIGH] src/app/auth.service.ts:?
   Insecure HTTP connection - use HTTPS

[↑↓] navigate  [Space] toggle  [S] solve selected  [Esc] exit
```

### 5. Solutions Viewer

Per-issue navigation. Each solution shows problem, explanation, and syntax-highlighted code fix.

```
 Solutions  1/8

● CRITICAL  Hardcoded secrets or credentials detected
  src/app/auth.service.ts
─────────────────────────────────────────

▸ Problem
  Hardcoded credentials are visible in source code...

▸ Solution  (typescript)
  │ import { config } from 'dotenv';
  │ config();
  │
  │ const password = process.env.DB_PASSWORD;

  ●○○○○○○○

[←→] Navigate  [N/P] Next/Prev  [A] Apply fix  [Q] Back
```

### 6. Apply Fix

Press `A`. AI generates structured patch, diff preview shown, confirm with `Y`.

```
 Apply Fix

File: src/app/auth.service.ts
Issue: Hardcoded secrets or credentials detected
Reason: Replace literal credential with env variable

─────────────────────────────────────────

- private password = 'admin123';

+ private password = process.env.DB_PASSWORD;

─────────────────────────────────────────

[Y] Apply   [N] Cancel
```

After write, the solution is removed from the list. When list empties, viewer auto-closes back to menu.

---

## Configuration

### Settings Screen

Open via main menu → Settings.

| Setting | Options |
|---------|---------|
| Provider | anthropic / openai / gemini |
| Model | live-fetched per provider (changes when provider switched) |
| API Key | hidden input, footer with `[Enter] save / [Esc] cancel / [Backspace] delete / [Ctrl+C] quit` |
| Language | english / spanish / french / german |
| Checks | toggle each agent on/off |

After entering API key:
- `[M]` → save and return to main menu
- `[Any key]` → save and stay in settings

### Live Model Fetching

| Provider | Endpoint |
|----------|----------|
| Anthropic | `GET /v1/models` (sorted by `created_at` desc) |
| OpenAI | `openai.models.list()` filtered to chat-capable |
| Gemini | `GET /v1beta/models` filtered by `generateContent` support |

Falls back to hardcoded list if API unreachable.

---

## Pattern Detection

Local pattern matchers run before AI calls. Each agent applies its regex set to the staged diff.

### Security

| Pattern | Severity |
|---------|----------|
| SQL injection (string concat in SELECT/UPDATE) | high |
| Hardcoded secrets (`password = 'xxx'`, `apiKey = '...'`) | critical |
| eval / `new Function()` / dynamic timer code | critical |
| `innerHTML =`, `dangerouslySetInnerHTML`, `document.write` | high |
| `http://` (non-https), localhost dev URLs | high |
| Path traversal (`fs.read(... + '..')`, `'../' + var`) | high |

### Quality

| Pattern | Severity |
|---------|----------|
| `: any`, `as any`, broad index signatures | medium |
| Optional chaining without null check | medium |
| Unused `const`/`let` declarations | low |

---

## How It Works

```
Staged git diff
      ↓
Local pattern detection (regex per agent)
      ↓
AI agents run in parallel (one per check type)
      ↓
Findings deduplicated and severity-filtered
      ↓
ResultsMenu (multi-select)
      ↓
Per-finding parallel AI solution generation (45s timeout each)
      ↓
SolutionsViewer
      ↓
Apply: AI generates {oldCode, newCode} JSON
      ↓
Substring validation (anti-hallucination)
      ↓
Diff preview + confirm
      ↓
writeFileSync
```

### Anti-Hallucination Guard

Apply rejects fixes when `oldCode` is not an exact substring of the file. Prevents AI from inventing code that breaks the file.

### Solution Alignment

Solutions are generated per-finding (not batched), guaranteeing 1:1 alignment between displayed solution and target file. Apply targets the correct issue every time.

---

## Limitations

- **Max 10 files** analyzed per run
- **8000 chars** per diff truncation limit
- **45s timeout** per AI solution call (parallel)
- **60s timeout** per Apply fix generation
- **No git auto-commit** — user reviews and commits manually after fixes

---

## Keyboard Reference

| Screen | Keys |
|--------|------|
| Main Menu | `↑↓` navigate · `Enter` select · `Q` quit |
| Configuration | `↑↓` navigate · `Space` toggle · `Enter` start · `Q` quit |
| Results | `↑↓` navigate · `Space` toggle · `S` solve selected · `Esc` exit |
| Solutions Viewer | `←→` / `N/P` navigate · `A` apply · `Q` back |
| Apply Confirm | `Y` apply · `N` cancel |
| API Key Entry | `Enter` save · `Esc` cancel · `Backspace` delete |
| Post-save Prompt | `M` main menu · any key stays in settings |
| Settings | `↑↓` navigate · `←→` change · `S` save · `Esc` back |

---

## Troubleshooting

### "API key not configured"

Open Settings → select provider → enter API key. Or set environment variable before launching.

### "No code changes found in git"

NEXUS analyzes staged + unstaged + untracked files. Ensure your changes are present in the working tree.

### "AI returned invalid JSON" on Apply

Model occasionally returns markdown-wrapped JSON. Retry; if persistent, switch to a stronger model in Settings (Claude Opus / GPT-4 typically reliable).

### "Cannot find target code in file"

AI hallucinated code that doesn't exist in the file. Cancel, navigate to next solution, or manually apply the suggested fix.

### Solutions stuck on "Generating solutions..."

Per-call timeout is 45s. If all 8 timeout, check network and API key validity. Failed findings get a fallback message instead of dropping all.

---

## Contributing

Issues / PRs: https://github.com/jhannka/nexus-cli

## License

MIT
