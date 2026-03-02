---
name: update-learnings
description: Update all learning docs after compound phase — LESSONS_LEARNED.md, MEMORY.md, and journal
argument-hint: "[cycle number]"
---

# Update Learnings

<command_purpose>After /workflows:compound creates the solution doc, this skill updates all the surrounding learning files so nothing falls through the cracks.</command_purpose>

## When to Run

Run immediately after `/workflows:compound` completes. The compound phase creates the solution doc; this skill propagates lessons to all the other files.

## Arguments

<update_target> $ARGUMENTS </update_target>

- First word = cycle number (e.g., "2" for Cycle 2). If omitted, detect from MEMORY.md or git log.

## Steps

### Step 1: Gather Context

Read these files to understand what just happened:

1. **Most recent solution doc** — `docs/solutions/` sorted by modification time, pick newest
2. **LESSONS_LEARNED.md** — current state of the hub
3. **MEMORY.md** — at `/Users/alejandroguillen/.claude/projects/-Users-alejandroguillen-Projects-liverequest/memory/MEMORY.md`
4. **Review summary** — `docs/reviews/*/REVIEW-SUMMARY.md` for the current branch (may not exist)
5. **Today's journal** — `~/Documents/dev-notes/$(date +%Y-%m-%d).md` (may not exist yet)

### Step 2: Identify New Lessons

From the solution doc and review summary, extract:

- **Key lesson** — one sentence for the Development History table
- **New top patterns** — did any pattern recur across 2+ cycles? Check existing Top Patterns table.
- **Risk chain** — what was flagged in feed-forward, what actually happened, what was learned
- **New solution doc** — filename and category for the Solution Docs Index

### Step 3: Update Files

Update these files (read each one first before editing):

#### 3a. LESSONS_LEARNED.md

- Add row to **Development History** table: `| [cycle] | [feature] | [key lesson] |`
- If a pattern recurred, add to **Top Patterns** table with cycle numbers and solution doc link
- If a new solution doc was created, add to **Solution Docs Index** table with category and cycle

#### 3b. MEMORY.md

- Update **Current State** section with latest cycle/feature completion
- Update **Key Docs** section if a new solution doc should be highlighted
- Update **Known Risks** if a risk was resolved or a new one discovered

#### 3c. Journal entry

- Append to `~/Documents/dev-notes/YYYY-MM-DD.md` (create if needed)
- Format: `## LiveRequest — Cycle N Complete: [Feature Name]`
- Include: What shipped, key lesson, patterns identified, next up
- Keep it concise — 30-50 lines max

### Step 4: Report

Print a summary:

```
Update Learnings — Cycle [N] Complete

Files updated:
  - LESSONS_LEARNED.md — added row [cycle] | [feature]
  - MEMORY.md — current state updated
  - ~/Documents/dev-notes/YYYY-MM-DD.md — journal entry appended

New patterns identified: [count or "none"]
```

## Future Files

When these files are created in the project, add them to the update list:

- `compound-engineering.local.md` — update Current State + Risk Chain sections
- `HANDOFF.md` — update "last completed" section
- `memory/workflow.md` — add to Things That Went Well / Things to Watch
- `memory/patterns.md` — add new code pattern sections

## Rules

1. **Read before writing** — always read a file before editing it
2. **Don't duplicate** — link to solution docs, don't copy their content into LESSONS_LEARNED.md
3. **Don't invent lessons** — only extract what's in the solution doc and review summary
4. **Keep LESSONS_LEARNED.md under 100 lines** — it's a hub, not a narrative
5. **Keep journal entries under 50 lines** — concise summary, not a rewrite of the solution doc
6. **Preserve existing content** — append, don't overwrite. Edit specific sections.
7. **Match existing format** — follow the table structures and section headers already in each file
