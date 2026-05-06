# Contributing to @walzate1/prism-pre-commit

Thanks for helping improve the pre-commit hook setup!

## Development Setup

```bash
git clone https://bitbucket.org/walzate1/prism-cli-pre-commit.git
cd prism-cli-pre-commit
npm install
```

## Testing Changes

### Test in a local project

```bash
# In your test project
npm install --save-dev /path/to/prism-cli-pre-commit

# Run setup
npx prism-pre-commit-setup

# Try committing
git add .
git commit -m "test"
```

### Test setup script directly

```bash
cd /path/to/test-project
node /path/to/prism-cli-pre-commit/src/setup.js
```

## File Structure

```
src/
├── setup.js          ← Main installation script
└── configs/
    └── .husky/
        └── pre-commit (template)

package.json          ← NPM metadata
README.md             ← User documentation
CONTRIBUTING.md       ← This file
```

## Making Changes

### 1. Modify setup.js

Changes to installation flow:

```javascript
// src/setup.js

// Add a new step
console.log('📦 Installing new tool...');
execSync('npm install --save-dev new-tool', { ... });
```

### 2. Update hook template

Changes to pre-commit behavior:

```sh
# .husky/pre-commit (embedded in setup.js)
npm run lint:check
npm run new-check    # ← Add custom step
```

### 3. Test thoroughly

Before submitting:
- [ ] Test on fresh project
- [ ] Test on Windows + Mac
- [ ] Test with node >=22.5.0
- [ ] Verify no breaking changes

## Submitting Changes

### Create a branch

```bash
git checkout -b feature/describe-change
```

### Commit with clear message

```
format: improve error messages

- Add color-coded output
- Show file paths in errors
- Add hints for common issues
```

### Push and create PR

```bash
git push origin feature/describe-change
```

Then create PR on Bitbucket with:
- **Title:** Short summary (under 50 chars)
- **Description:** Why change needed, what changed, how to test

## Code Style

- JavaScript (Node.js compatible)
- No external dependencies for setup.js (keep it light)
- Use `console.log()` for output, never silent failures
- Error messages should be actionable ("Install X with `npm install X`")

## Backwards Compatibility

Breaking changes are rare. If modifying setup.js:
- Ensure works with existing `.husky/` directories
- Don't delete user config without asking
- Support rollback via uninstall docs

## Release Process

Releases are tagged and published to GitHub Packages.

```bash
# After merging PR, bump version
npm version minor
npm publish
git push origin --tags
```

## Questions?

- Open an issue on Bitbucket
- Ask in team Slack
- Review existing issues for context

Happy coding! 🚀
