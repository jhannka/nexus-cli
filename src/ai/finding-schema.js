export const FINDING_CATEGORIES = [
  'bug',
  'security',
  'performance',
  'style',
  'maintainability',
  'accessibility',
  'testing',
  'architecture',
  'documentation',
  'other'
];

export const FINDING_SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];

export const FINDING_TOOL_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['filePath', 'lineNumber', 'severity', 'category', 'title', 'problem', 'rationale', 'suggestion'],
        properties: {
          filePath: { type: 'string' },
          lineNumber: { type: 'integer', minimum: 1 },
          severity: { enum: FINDING_SEVERITIES },
          category: { enum: FINDING_CATEGORIES },
          title: { type: 'string', maxLength: 100 },
          problem: { type: 'string', maxLength: 500 },
          rationale: { type: 'string', maxLength: 500 },
          suggestion: { type: 'string', maxLength: 500 }
        }
      }
    }
  },
  required: ['findings']
};

export function normalizeFinding(raw, agentId) {
  if (!raw || typeof raw !== 'object') return null;
  const f = raw;
  if (typeof f.filePath !== 'string' || f.filePath.length === 0) return null;
  if (!Number.isInteger(f.lineNumber) || f.lineNumber < 1) return null;
  if (!FINDING_SEVERITIES.includes(f.severity)) return null;
  if (!FINDING_CATEGORIES.includes(f.category)) return null;
  if (typeof f.title !== 'string' || f.title.length === 0) return null;
  if (typeof f.problem !== 'string' || f.problem.length === 0) return null;
  if (typeof f.rationale !== 'string' || f.rationale.length === 0) return null;
  if (typeof f.suggestion !== 'string' || f.suggestion.length === 0) return null;
  return {
    filePath: f.filePath,
    lineNumber: f.lineNumber,
    severity: f.severity,
    category: f.category,
    title: f.title,
    problem: f.problem,
    rationale: f.rationale,
    suggestion: f.suggestion,
    agentId
  };
}
