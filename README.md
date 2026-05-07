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

Counts shown above are recalculated after deduplication and the current severity filter, so agents whose issues were dropped now report `0 findings`, keeping the UI honest and stabilizing per-agent metrics.

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

The redesigned ResultsMenu now:

1. **Sorts findings** by severity (critical → low) then file:line so the riskiest issues stay at the top.
2. **Displays only 10 rows per page** with pagination via `PgUp/PgDn`, while the header shows `Total · C critical · H high · M medium` plus the selected count.
3. **Truncates file paths/titles** to fit, keeping the cursor, checkbox, severity tag, and `file:line` visible.
4. **Shows a detail panel below** the list that renders the Problem and Suggestion text for the currently highlighted finding (wrapped to the current terminal width).

New shortcuts help deal with big reviews: `[A]` select all, `[N]` deselect all, `[PgUp/PgDn]` page, `[g/G]` jump to top/bottom, and `[Q]/[Esc]` cancel back to the main menu.

Per-agent counts and the header breakdown are recomputed after schema validation, deduplication, and severity filtering, so they always match the findings you can actually navigate and solve.

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

## AI Agents

Each agent runs as a separate AI call with a dedicated system prompt. Prompts live in `src/ai/prompts/*.txt` and follow the prism-style structure: focus areas, severity criteria, output format.

| Agent | Prompt | Focus |
|-------|--------|-------|
| security | `security-reviewer.txt` | OWASP Top 10: SQL injection, auth bypass, secrets, XSS, path traversal, SSRF, crypto, sensitive data leaks |
| performance | `performance-reviewer.txt` | N+1 queries, blocking I/O, memory leaks, expensive loops, unnecessary re-renders |
| architecture | `architecture-reviewer.txt` | SOLID violations, layering, coupling, separation of concerns |
| testing | `testing-reviewer.txt` | Missing tests for changed logic, brittle assertions, coverage gaps |
| quality / types / lint | `ts-reviewer.txt` | Type safety, null handling, dead code, consistency |

### How AI Validation Works

1. **Diff parsing** — raw `git diff` parsed into structured form, each addition tagged with `[L{lineNumber}]` so the AI can reference exact lines.
2. **System prompt assembly** — base prompt + injected sections:
   - `DIFF_AWARENESS` — "you see only diff, don't flag missing code outside it"
   - `LANGUAGE` — output findings in user's chosen language (en/es/fr/de)
   - `SEVERITY_FOCUS` — "report only severities ≥ user threshold"
   - `ACCESSIBILITY_DISABLED` — opt-out by default to reduce noise
3. **Tool calling** — provider-native structured output:
   - Anthropic → native `tool_use` with `report_findings` schema
   - OpenAI → function calling with same schema
   - Gemini → `responseMimeType: application/json`
4. **Schema validation** — each returned finding must have `filePath`, `lineNumber`, `severity`, `category`, `title`, `problem`, `rationale`, `suggestion`. Invalid entries dropped.
5. **Line number validation** — `lineNumber` must match a real addition line in the diff. Hallucinated lines dropped.
6. **Severity filter at agent level** — findings below user's `minSeverity` dropped before returning.

### Determinism

All AI calls use `temperature: 0`. OpenAI also passes `seed: 42`. Same diff + same prompts → same findings (within model's deterministic guarantees).

### Dedup Strategy

When multiple agents flag the same `file:line`, only the highest-severity finding is kept. Per-agent counts are recomputed after dedup so UI matches final list.

---

## How It Works

```
Staged git diff
      ↓
parseDiff → [L{num}] annotations
      ↓
N parallel AI tool calls (one per agent, temperature=0)
      ↓
Schema validation + line validation + severity filter
      ↓
Dedup by file:line (keep highest severity)
      ↓
ResultsMenu (sorted, paginated, detail panel)
      ↓
[S] Solve → per-finding parallel solution generation
      ↓
SolutionsViewer (syntax-highlighted, navigable)
      ↓
[A] Apply → AI generates {oldCode, newCode, reason}
      ↓
Substring validation (anti-hallucination)
      ↓
Diff preview + [Y]/[N] confirm
      ↓
writeFileSync → splice from list
```

### Anti-Hallucination Guards

- **Line numbers**: `lineNumber` returned by AI must match an actual addition line in the diff. If not, finding dropped.
- **Apply patches**: `oldCode` must be exact substring of file content. If not, write rejected — AI invented code that doesn't exist.

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
| Results | `↑↓` navigate · `Space` toggle · `S` solve selected · `A` select all · `N` select none · `PgUp/PgDn` page · `g/G` home/end · `Q`/`Esc` cancel |
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
