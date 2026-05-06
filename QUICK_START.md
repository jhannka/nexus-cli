# Quick Start — 2 Minutes

Get pre-commit hooks running in your TypeScript project right now.

## Install (30 seconds)

### Option A: Per-Project

```bash
npm install --save-dev @walzate1/prism-pre-commit
npx prism-pre-commit-setup
```

### Option B: Global (Install Once, Use Everywhere)

```bash
npm install -g @walzate1/prism-pre-commit
prism-pre-commit-setup
```

That's it. Done.

## Try It (30 seconds)

```bash
# Make a change
echo "// test" >> src/index.ts

# Stage + commit
git add .
git commit -m "test"
```

Hook runs automatically. Checks lint → format → types → tests.

## Common Scenarios

### ✅ All checks pass → Commit succeeds

```
> npm run lint:check
✓ No issues

> npm run format:check
✓ Formatted correctly

> npm run type:check
✓ Types valid

> npm run test
✓ All tests pass

[main abc1234] test commit
```

### ❌ Lint fails → Commit blocked

```
> npm run lint:check
✗ src/index.ts:5 unused variable 'x'

❌ Commit blocked.

$ vim src/index.ts        # Remove 'x'
$ git add src/index.ts
$ git commit -m "test"    # Retry
✅ Success
```

### ❌ Format fails → Auto-fix and retry

```
> npm run format:check
✗ Code style issues in 2 files

$ npm run format          # Auto-fix
$ git add .
$ git commit -m "test"    # Retry
✅ Success
```

## What Runs

Each commit runs these in order. If any fails, commit is blocked:

1. **Lint check** (`npm run lint:check`)
   - ESLint rules
   - Auto-fixable issues get fixed

2. **Format check** (`npm run format:check`)
   - Prettier validation
   - Run `npm run format` to auto-fix

3. **Type check** (`npm run type:check`)
   - TypeScript validation
   - Compile errors block commit

4. **Tests** (`npm run test`)
   - Vitest suite
   - Failing tests block commit

## Skip Hooks (Emergency)

```bash
git commit --no-verify
```

⚠️ Only use if absolutely necessary. Hooks protect your code.

## Need Help?

- **Read full docs:** [README.md](./README.md)
- **Setup issues:** [Troubleshooting](./README.md#troubleshooting)
- **Contributing:** [CONTRIBUTING.md](./CONTRIBUTING.md)
