/**
 * Parse a unified diff string into structured form.
 * Returns array of { newPath, hunks: [{ oldStart, oldCount, newStart, newCount, header, lines: [{ type, content, lineNumber }] }] }
 */
export function parseDiff(rawDiff) {
  const files = [];
  let currentFile = null;
  let currentHunk = null;
  let newLineNum = 0;
  let oldLineNum = 0;

  const lines = rawDiff.split('\n');
  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      currentFile = null;
      currentHunk = null;
      continue;
    }
    if (line.startsWith('--- ')) continue;
    if (line.startsWith('+++ ')) {
      const path = line.slice(4).replace(/^b\//, '').trim();
      if (path === '/dev/null') continue;
      currentFile = { newPath: path, hunks: [] };
      files.push(currentFile);
      continue;
    }
    if (line.startsWith('@@')) {
      const m = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@(.*)$/);
      if (!m || !currentFile) continue;
      currentHunk = {
        oldStart: parseInt(m[1], 10),
        oldCount: m[2] ? parseInt(m[2], 10) : 1,
        newStart: parseInt(m[3], 10),
        newCount: m[4] ? parseInt(m[4], 10) : 1,
        header: (m[5] || '').trim(),
        lines: []
      };
      currentFile.hunks.push(currentHunk);
      newLineNum = currentHunk.newStart;
      oldLineNum = currentHunk.oldStart;
      continue;
    }
    if (!currentFile || !currentHunk) continue;
    if (line.startsWith('+')) {
      currentHunk.lines.push({ type: 'addition', content: line.slice(1), lineNumber: newLineNum });
      newLineNum++;
    } else if (line.startsWith('-')) {
      currentHunk.lines.push({ type: 'deletion', content: line.slice(1), lineNumber: oldLineNum });
      oldLineNum++;
    } else if (line.startsWith(' ')) {
      currentHunk.lines.push({ type: 'context', content: line.slice(1), lineNumber: newLineNum });
      newLineNum++;
      oldLineNum++;
    }
  }
  return files;
}

/**
 * Build annotated diff content for AI input.
 * Lines marked with [L{num}] for additions so AI can reference exact line numbers.
 */
export function buildAnnotatedDiff(files) {
  const blocks = [];
  for (const file of files) {
    const lines = [];
    lines.push(`### ${file.newPath}`);
    lines.push('```diff');
    for (const hunk of file.hunks) {
      lines.push(`@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@${hunk.header ? ' ' + hunk.header : ''}`);
      for (const line of hunk.lines) {
        if (line.type === 'addition') {
          lines.push(`[L${line.lineNumber}] + ${line.content}`);
        } else if (line.type === 'deletion') {
          lines.push(`       - ${line.content}`);
        } else {
          lines.push(`         ${line.content}`);
        }
      }
    }
    lines.push('```');
    blocks.push(lines.join('\n'));
  }
  return blocks.join('\n\n');
}

/**
 * Returns true if the given lineNumber appears as an addition line in any file.
 * Used post-AI to validate finding line numbers.
 */
export function isValidAdditionLine(filePath, lineNumber, files) {
  const file = files.find(f => f.newPath === filePath);
  if (!file) return false;
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'addition' && line.lineNumber === lineNumber) return true;
    }
  }
  return false;
}
