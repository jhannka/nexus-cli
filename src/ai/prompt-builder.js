import { FINDING_SEVERITIES } from './finding-schema.js';

const DIFF_AWARENESS_INSTRUCTION = `## Diff Awareness (CRITICAL)

You are reviewing a DIFF — NOT the full source file. Only changed lines and a few lines of surrounding context are shown. Large portions of each file are NOT visible to you.

**Rules:**
- Do NOT flag "missing code" unless the missing code is directly required by NEW lines in the diff.
- If the diff shows a pattern that implies supporting code (e.g. \`takeUntil(this.destroy)\` implies \`ngOnDestroy\`, an import implies a declaration), ASSUME the supporting code exists in the invisible portion of the file unless there is direct evidence IN THE DIFF that it is missing (e.g. a new class that lacks the method).
- Only report issues about code you CAN see. Never speculate about code outside the diff.
- "I don't see X in the diff" is NOT the same as "X is missing from the file."`;

const LANGUAGE_INSTRUCTIONS = {
  english: `## Language

You MUST write all finding fields (problem, rationale, suggestion) in English.
Keep technical terms (variable names, function names, types, keywords) in their original language.
Be concise — maximum 120 tokens per finding field.`,
  spanish: `## Language

You MUST write all finding fields (problem, rationale, suggestion) in Spanish.
Keep technical terms (variable names, function names, types, keywords) in their original language.
Be concise — maximum 120 tokens per finding field.`,
  french: `## Language

You MUST write all finding fields (problem, rationale, suggestion) in French.
Keep technical terms (variable names, function names, types, keywords) in their original language.
Be concise — maximum 120 tokens per finding field.`,
  german: `## Language

You MUST write all finding fields (problem, rationale, suggestion) in German.
Keep technical terms (variable names, function names, types, keywords) in their original language.
Be concise — maximum 120 tokens per finding field.`
};

function buildSeverityInstruction(minSeverity) {
  if (!minSeverity) return undefined;
  const minIndex = FINDING_SEVERITIES.indexOf(minSeverity);
  if (minIndex < 0) return undefined;
  const allowed = FINDING_SEVERITIES.slice(0, minIndex + 1);
  const below = minIndex + 1 < FINDING_SEVERITIES.length
    ? FINDING_SEVERITIES.slice(minIndex + 1).join(', ')
    : 'below the threshold';
  return `## Severity Focus

ONLY report findings with severity: ${allowed.join(', ')}.
Do NOT report findings below ${minSeverity}. Ignore issues that would be ${below}.
Focus your analysis effort on finding ${allowed.join(', ')} issues only.`;
}

const ACCESSIBILITY_DISABLED = `## Accessibility: DISABLED

Do NOT report accessibility (a11y) findings. This includes: missing alt attributes, missing aria-label/aria-labelledby, heading hierarchy issues, missing form labels, non-focusable interactive elements, and any WCAG-related concerns.
Accessibility checks are opt-in for this project. Skip all a11y analysis entirely.`;

export function buildSystemPrompt(basePrompt, options = {}) {
  const { language = 'english', minSeverity, accessibility = false } = options;

  const sections = [basePrompt, DIFF_AWARENESS_INSTRUCTION];

  const langInst = LANGUAGE_INSTRUCTIONS[language] || LANGUAGE_INSTRUCTIONS.english;
  sections.push(langInst);

  if (!accessibility) {
    sections.push(ACCESSIBILITY_DISABLED);
  }

  const sevInst = buildSeverityInstruction(minSeverity);
  if (sevInst) sections.push(sevInst);

  return sections.join('\n\n');
}
