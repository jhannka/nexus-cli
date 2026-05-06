import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

export class LocalChecks {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
  }

  run(config) {
    const findings = [];
    const packageJsonPath = resolve(this.projectRoot, 'package.json');

    if (!existsSync(packageJsonPath)) return findings;
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

    if (config.checks.lint && (packageJson.devDependencies?.eslint || packageJson.dependencies?.eslint)) {
      findings.push(...this.runESLint());
    }

    if (config.checks.types && (packageJson.devDependencies?.typescript || packageJson.dependencies?.typescript)) {
      findings.push(...this.runTypeScript());
    }

    return findings;
  }

  runESLint() {
    const findings = [];
    try {
      execSync('npx eslint src/ --format json', {
        stdio: 'pipe',
        cwd: this.projectRoot
      });
    } catch (error) {
      const output = error.stdout?.toString() || '[]';
      try {
        const eslintFindings = JSON.parse(output);
        eslintFindings.forEach(file => {
          file.messages.forEach(msg => {
            findings.push({
              type: 'lint',
              file: file.filePath,
              line: msg.line,
              message: msg.message,
              severity: msg.severity === 2 ? 'error' : 'warning'
            });
          });
        });
      } catch {}
    }
    return findings;
  }

  runTypeScript() {
    const findings = [];
    try {
      execSync('npx tsc --noEmit', { stdio: 'pipe', cwd: this.projectRoot });
    } catch (error) {
      const output = error.stderr?.toString() || error.stdout?.toString() || '';
      const typeErrors = output.match(/error TS\d+:/g) || [];
      if (typeErrors.length > 0) {
        findings.push({
          type: 'types',
          message: `Found ${typeErrors.length} type errors`,
          severity: 'error'
        });
      }
    }
    return findings;
  }
}
