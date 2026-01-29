---
description: Comprehensive context-aware review with 3 parallel specialized reviewers
argument-hint: [feature description]
allowed-tools: [Read, Task, Bash, Grep, Glob, Edit, AskUserQuestion]
---

Perform comprehensive quality review of recently completed feature implementations using **3 parallel specialized reviewers** for thorough coverage.

## Usage

**Automatic (Claude-triggered):**
- Claude proactively runs this when feature work is complete
- Uses SlashCommand tool to invoke the review
- Triggers when: todos complete, non-trivial feature implemented, or multiple files modified

**Manual:**
```
/review-feature                        # Auto-detect feature from context
/review-feature "admin statistics"     # Optional: specify feature focus
```

## How It Works

This command launches **3 specialized reviewers in parallel**, each focusing on different aspects:

| Reviewer | Focus Area | Key Checks |
|----------|------------|------------|
| **Simplicity & Elegance** | Code quality | DRY violations, complexity, clarity, abstraction appropriateness |
| **Correctness & Bugs** | Functional issues | Logic errors, edge cases, null handling, race conditions, type safety |
| **Conventions & Standards** | Project alignment | CLAUDE.md compliance, naming, file org, API patterns, test patterns |

After all 3 complete, findings are consolidated, de-duplicated, and presented by severity.

## Instructions for Claude

When this command is invoked:

### Step 1: Gather Context

**Note:** Project conventions from CLAUDE.md are automatically included in your context if present. Use those patterns for project-specific guidance.

```bash
# Identify what was recently changed
git diff --name-only HEAD~5...HEAD
git log --oneline -5
```

Determine the feature scope from:
- Git changes
- Todo list (recently completed items)
- Conversation context
- User-provided argument ($1)

### Step 2: Launch 3 Reviewers in Parallel

**CRITICAL: Launch all 3 Task tool calls in a SINGLE MESSAGE for true parallel execution.**

**Note:** CLAUDE.md conventions are automatically in your context. Reference them in reviewer prompts.

```
# Reviewer 1: Simplicity & Elegance
Task(
  subagent_type="general-purpose",
  description="Review code simplicity",
  model="opus",
  prompt="""
  Review the recently changed files for SIMPLICITY & ELEGANCE.

  Feature: [FEATURE_DESCRIPTION]
  Changed files: [FILE_LIST]

  ## Focus Areas
  (Check CLAUDE.md in your context for project-specific patterns)
  1. DRY violations - duplicated code that should be extracted
  2. Unnecessary complexity - over-engineering, premature abstraction
  3. Code clarity - naming, comments, self-documenting code
  4. Abstraction appropriateness - right level of abstraction
  5. Function/method length - too long, should be split

  For each issue found:
  - Severity: HIGH/MEDIUM/LOW
  - File: path:line
  - Problem: Clear description
  - Recommendation: Specific fix

  Output format:
  ## Simplicity & Elegance Review

  ### Issues Found
  [List issues by severity]

  ### Summary
  [Brief overall assessment]
  """
)

# Reviewer 2: Correctness & Bugs
Task(
  subagent_type="general-purpose",
  description="Review for bugs",
  model="opus",
  prompt="""
  Review the recently changed files for CORRECTNESS & BUGS.

  Feature: [FEATURE_DESCRIPTION]
  Changed files: [FILE_LIST]

  ## General Focus Areas
  (Check CLAUDE.md in your context for project-specific bug patterns and high-value code)
  1. Logic errors - incorrect conditions, wrong operators
  2. Edge cases - empty arrays, null values, boundary conditions
  3. Race conditions - async issues, state management
  4. Null/undefined handling - missing optional chaining, null checks
  5. Type safety - any types, missing type guards
  6. Error handling - uncaught exceptions, missing error paths
  7. Memory leaks - unclosed resources, missing cleanup

  ## Language-Specific Patterns

  **Python:**
  - Missing `await` on async functions (returns coroutine, not result)
  - Database loops missing rollback in exception handlers
  - Transactions not properly closed on errors

  **TypeScript/JavaScript:**
  - Missing optional chaining for nested access
  - Direct state mutation instead of immutable updates
  - Stale closure in useEffect (missing dependencies)

  **Schema Alignment:**
  - Backend model fields vs Frontend interface fields mismatch
  - Naming convention inconsistency between layers
  - Optional fields not properly typed on both sides

  For CRITICAL bugs (crashes, security, data loss):
  - Mark as CRITICAL
  - Provide exact fix

  For each issue found:
  - Severity: CRITICAL/HIGH/MEDIUM/LOW
  - File: path:line
  - Problem: Clear description
  - Impact: What goes wrong
  - Fix: Specific code change

  Output format:
  ## Correctness & Bugs Review

  ### CRITICAL Issues (require immediate fix)
  [List critical bugs]

  ### Other Issues
  [List by severity]

  ### Summary
  [Brief overall assessment]
  """
)

# Reviewer 3: Conventions & Standards
Task(
  subagent_type="general-purpose",
  description="Review conventions",
  model="opus",
  prompt="""
  Review the recently changed files for CONVENTIONS & STANDARDS.

  Feature: [FEATURE_DESCRIPTION]
  Changed files: [FILE_LIST]

  ## General Focus Areas
  (Check CLAUDE.md in your context for project-specific conventions)
  1. Naming conventions - variables, functions, files
  2. File organization - correct directories, module structure
  3. API patterns - consistent error handling, response formats
  4. Test patterns - following existing test structure
  5. Import organization - proper ordering, no circular deps
  6. Documentation - missing docstrings, outdated comments

  ## Universal Checks
  - New API endpoints should have tests
  - New components should have at least basic tests
  - Build/test commands should pass

  For each issue found:
  - Severity: HIGH/MEDIUM/LOW
  - File: path:line
  - Problem: Clear description
  - Convention: Which rule was violated
  - Fix: How to comply

  Output format:
  ## Conventions & Standards Review

  ### Issues Found
  [List issues by severity]

  ### Summary
  [Brief overall assessment]
  """
)
```

### Step 3: Consolidate Findings

After all 3 reviewers complete:

1. **Merge by severity**: CRITICAL > HIGH > MEDIUM > LOW
2. **De-duplicate**: Same issue found by multiple reviewers → keep one
3. **Auto-fix CRITICAL**: Apply fixes immediately using Edit tool
4. **Verify builds**: Run test commands from CLAUDE.md or infer from project

### Step 4: Present Consolidated Report

```markdown
## Feature Review: [Feature Name]

**Scope:** [Brief description]
**Files Reviewed:** [count]
**Reviewers:** 3 parallel (Simplicity, Correctness, Conventions)
**Conventions:** [From CLAUDE.md / Generic patterns]

---

### CRITICAL Issues (Auto-Fixed)

| File | Issue | Fix Applied |
|------|-------|-------------|
| path:line | [problem] | [fix] |

---

### HIGH Priority Issues

| File | Issue | Recommendation |
|------|-------|----------------|
| path:line | [problem] | [fix] |

---

### MEDIUM Priority Issues

| File | Issue | Recommendation |
|------|-------|----------------|
| path:line | [problem] | [fix] |

---

### LOW Priority Issues

| File | Issue | Recommendation |
|------|-------|----------------|
| path:line | [problem] | [fix] |

---

### Positive Findings
- [Well-designed aspects]
- [Good patterns followed]

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | X | Auto-fixed |
| HIGH | Y | Needs attention |
| MEDIUM | Z | Recommended |
| LOW | W | Optional |

**Build Status:**
- Tests: [pass/fail]
- Build: [pass/fail]

**Recommended Next Steps:**
1. [Priority action]
2. [Secondary action]
```

### Step 5: Ask User About Remaining Issues

If HIGH issues remain after auto-fixing CRITICAL:

```
Use AskUserQuestion:
- header: "Issues"
- question: "How would you like to handle the remaining HIGH priority issues?"
- options:
  - "Fix now" - I'll address all HIGH issues immediately
  - "Fix later" - Add to backlog, proceed with current state
  - "Show details" - Explain each HIGH issue before deciding
```

## Key Benefits

- **Parallel execution**: 3 reviewers run simultaneously for speed
- **Specialized focus**: Each reviewer has deep expertise in their area
- **Comprehensive coverage**: No blind spots from overlapping responsibilities
- **Consolidated output**: De-duplicated, severity-ranked findings
- **Auto-fix CRITICAL**: Immediate resolution of severe issues
- **Project-aware**: Reviewers use CLAUDE.md conventions if available

## Notes

- All 3 Task calls MUST be in a single message for true parallel execution
- CRITICAL issues are auto-fixed immediately
- HIGH/MEDIUM/LOW issues are reported for user decision
- Builds are verified after applying fixes
- Each reviewer uses opus model for thorough analysis
- Reviewers will use generic patterns if CLAUDE.md doesn't exist
