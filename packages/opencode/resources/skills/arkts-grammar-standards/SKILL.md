---
name: arkts-grammar-standards
description: Use this skill for ArkTS syntax rules, ArkTS-specific restrictions, TypeScript-to-ArkTS syntax differences, and syntax compliance review. It is suitable when the user is writing ArkTS, reviewing ArkTS code, asking why a syntax form is allowed or forbidden, or asking how to rewrite a TypeScript syntax pattern into valid ArkTS.
---

# arkts-grammar-standards

Use this skill to answer ArkTS syntax and restriction questions with grounded references.

Prefer the bundled reference files over model memory. Keep the answer focused on:

- whether a syntax form is allowed
- what ArkTS expects instead
- whether the rule comes from the language guide or from the linter-derived summary
- which topic best matches the user's code or question

## Reference order

Read these files as needed:

1. `references/topic-aliases.json`
2. `references/basic-syntax.md`
3. `references/restrictions.md`
4. `references/ts-diff.md`

Use `basic-syntax.md` for normal ArkTS writing patterns.
Use `restrictions.md` when the question is about forbidden syntax, restricted operators, object literal rules, `Sendable`, or review comments.
Use `ts-diff.md` when the user is porting TypeScript or asking why a familiar TypeScript pattern does not work in ArkTS.

## Source rules

- Treat `basic-syntax.md` and `ts-diff.md` as guide-oriented summaries backed by the bundled ArkTS language guide sections.
- Treat `restrictions.md` as implementation-derived guidance based on the linter summary. Say that clearly when citing it.
- Do not present linter-derived restrictions as if they were verbatim official spec text.
- If both a guide-oriented explanation and a linter restriction apply, mention both and explain the relationship in one or two sentences.

## Response shape

Use this format unless the user asks for something else:

```markdown
- Topic: <short topic>
- Source: <guide-summary | linter-summary | ts-diff-summary>
- Reference: <reference file and section>
- Why it matches: <one sentence>
- Guidance: <one or two sentences>
```

If the user shows code, add a short rewrite suggestion after the guidance.

## Working rules

- Prefer direct syntax guidance over broad language tutorials.
- Prefer named ArkTS alternatives such as class, interface, explicit field type, arrow function, or direct property access.
- Keep citations short and traceable.
- Do not expand the answer into build, run, debug, or tool workflows unless the user explicitly asks for that after the syntax answer.
