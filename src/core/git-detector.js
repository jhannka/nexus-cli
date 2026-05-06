import { execSync } from 'child_process';

export class GitDetector {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
  }

  getChangedFiles() {
    try {
      const stagedOutput = execSync('git diff --name-only --cached', {
        cwd: this.projectRoot,
        encoding: 'utf-8'
      }).trim();

      const unstagedOutput = execSync('git diff --name-only', {
        cwd: this.projectRoot,
        encoding: 'utf-8'
      }).trim();

      const untrackedOutput = execSync('git ls-files --others --exclude-standard', {
        cwd: this.projectRoot,
        encoding: 'utf-8'
      }).trim();

      const stagedFiles = stagedOutput ? stagedOutput.split('\n') : [];
      const unstagedFiles = unstagedOutput ? unstagedOutput.split('\n') : [];
      const untrackedFiles = untrackedOutput ? untrackedOutput.split('\n') : [];

      const allChanges = [...new Set([...stagedFiles, ...unstagedFiles, ...untrackedFiles])];

      const codeFiles = allChanges.filter(f => {
        const ignored = ['node_modules', 'dist', 'build', '.git', '.env', 'package-lock.json', 'yarn.lock'];
        return !ignored.some(pattern => f.includes(pattern)) && f.trim();
      });

      return codeFiles.slice(0, 10);
    } catch (error) {
      return [];
    }
  }

  getChangeDiff(files) {
    const diffs = {};
    files.forEach(file => {
      try {
        const diff = execSync(`git diff ${file}`, {
          cwd: this.projectRoot,
          encoding: 'utf-8'
        });
        if (diff) diffs[file] = diff;
      } catch {}
    });
    return diffs;
  }
}
