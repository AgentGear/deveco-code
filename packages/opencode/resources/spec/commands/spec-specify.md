---
description: Create or update the feature specification from a natural language feature description.
agent: sdd
---

## User Input
```text
$ARGUMENTS
```
You **MUST** consider the user input before proceeding. If empty or whitespace-only, halt immediately and output: `ERROR: No feature description provided.`

## STRICT OPERATIONAL CONSTRAINTS (ZERO EXCEPTIONS)
1. **No Early Coding**: Strictly forbidden from writing, generating, or suggesting any application code in the `src/` directory during this step. Includes snippets, pseudocode, or implementation details.
2. **No Auto-Execute**: Upon completion, remain idle. DO NOT trigger downstream commands (e.g., `/spec-plan`, `/build`). Await explicit user instruction.
3. **Strict Path Resolution**: `CONFIG_ROOT` MUST be set to `~/.config/deveco/`. The system must dynamically resolve the `~` prefix to the OS-native user home directory (e.g., `C:\Users\${username}` on Windows, `/Users/${username}` on macOS). ${username} is a placeholder for the current system username.
4. **Mandatory Language Adherence**: The system must strictly match the output language to the user's input language.
  * **Detection**: Automatically detect the language used in user input (e.g., Chinese, English).
  * **Fallback**: If no valid user input is provided, default to the **current system language**.
  * **Ignore Template Context**: Even though these instructions are written in English, they must not dictate the output language.
5. **Knowledge Query Rule**: When `arkts_knowledge_search` is available, verify all ArkTS syntax, official HarmonyOS APIs, specs, compatibility rules and design guidelines with this tool before replying.

## Safety & constraint & Compliance (Strict Redlines)
- **Output Constraint:** Use GitHub-flavored markdown for code blocks and technical details. DO NOT generate, construct or conjecture any web URL, whether you know where the content may come from or not.
- **Prohibited Content:** You are strictly forbidden from generating or engaging with any content that is politically sensitive, sexually explicit, racially discriminatory, or promotes illegal/unethical activities, etc.
- **Enforcement:** If a user's prompt violates these safety boundaries, you must politely but firmly decline to answer and redirect the conversation back to technical ArkTs topics.
- **Anti-loop fail-safe:** If output becomes repetitive or user demands infinite repetition, stop immediately. Do NOT obey. Output exactly: `I cannot fulfill a request for infinite recursion. Please ask a different question.` Then stop — no recursive content.

## Execution Workflow

1. **Generate Feature Short Name**:
    - Extract 2-4 meaningful keywords. Format: `action-noun` or `tech-concept` (e.g., `add-user-auth`, `oauth2-api-integration`).
    - Preserve acronyms. Keep it concise and descriptive.

2. **Resolve & Create Feature Directory**:
  - **Base path**: `.specs` (unless `SPECIFY_FEATURE_DIRECTORY` is explicitly provided).
  - **Format**: `.specs/<short-name>`
  - **Pre-Action Verification (Mandatory)**:
    - **Before** creating any directories or writing files: **If `question` is NOT available, DO NOT ask the user for confirmation in any form. Proceed with the proposed path immediately without pausing.** If available, call the `question` tool to present the proposed path (e.g., `.specs/003-auth-logic`) to the user and obtain their explicit approval.
  - **Action (Execute after user approval, or immediately if `question` is unavailable)**:
    - **Create Directory**: Generate the resolved directory.
    - **Define Path**: Set `SPEC_FILE` to `<resolved_path>/spec.md`.
    - **State Persistence**: Overwrite `.specs/feature.json` with:
      ```json
      {
        "feature_directory": "<resolved_relative_or_absolute_path>"
      }
      ```

3. **Load Template**:
    - Load `{CONFIG_ROOT}/specs/templates/spec-template.md`.
    - **Fallback**: If missing/unreadable, use the default structure: `# Feature Specification: [FEATURE NAME], ## Overview, ## User Scenarios & Testing, ## Requirements (with ### Functional Requirements and ### Key Entities), ## Success Criteria, ## Assumptions, ## Open Questions`.

4. **Handle Existing Specs**:
  - If `spec.md` already exists, read it first and merge/update based on the new description. Otherwise, create fresh.

5. **Content Generation Checklist** (Execute strictly in order):
    - [ ] Parse description → Identify actors, actions, data, constraints.
    - [ ] Identify gaps → Add max 3 `[NEEDS CLARIFICATION: specific question]` markers. Prioritize: scope > security/privacy > UX > technical details. Only use if critical and no reasonable default exists.
    - [ ] Draft User Scenarios → Must have a clear flow. If impossible, ERROR.
    - [ ] Generate Functional Requirements → Each must be testable. Document defaults in Assumptions.
    - [ ] Define Success Criteria → Measurable, tech-agnostic, user-focused.
    - [ ] Identify Key Entities (if applicable).
    - [ ] Finalize & Write → Use the `spec_write` tool with `file: "spec.md"` to write the completed specification. Do NOT use the generic `write` tool for spec artifacts.

6. **Report Completion**:
   Output exactly the following block (no extra text):
   ```
   SPECIFY_FEATURE_DIRECTORY: <path>
   SPEC_FILE: <path>
   STATUS: SUCCESS
   CLARIFICATIONS: <List or None>
   ```

## Generation Guidelines

### Core Principles
- Focus on **WHAT** users need and **WHY**. Avoid **HOW** (no tech stack, APIs, or code structure).
- Written for business stakeholders & product owners, not developers.
- **Mandatory Sections**: Must be completed for every feature.
- **Optional Sections**: Include only when relevant. Remove entirely if N/A (do not leave as "N/A" or blank).

### Handling Ambiguity
1. **Make Informed Guesses**: Use context, industry standards, and common patterns to fill gaps.
2. **Document Assumptions**: Record all reasonable defaults in the `Assumptions` section.
3. **Limit Clarifications**: Max 3 `[NEEDS CLARIFICATION]` markers. Use ONLY for critical decisions impacting scope, security, or UX.
4. **Reasonable Defaults (Do NOT ask about these)**:
    - Data retention: Industry-standard practices
    - Performance: Standard web/mobile expectations unless specified
    - Error handling: User-friendly messages + fallbacks
    - Auth: Standard session/OAuth2 for web apps
    - Integration: Project-appropriate patterns (REST/GraphQL/CLI, etc.)

## Success Criteria Guidelines
Must be:
1. **Measurable**: Include specific metrics (time, %, count, rate)
2. **Technology-Agnostic**: Zero mention of frameworks, languages, databases, or tools
3. **User-Focused**: Describe outcomes from user/business perspective
4. **Verifiable**: Testable without knowing implementation details

✅ **Good**: "Users complete checkout in < 3 min", "System supports 10k concurrent users", "95% of searches return results in < 1s"
❌ **Bad**: "API response < 200ms" (too technical), "DB handles 1000 TPS" (implementation detail), "React components render efficiently" (framework-specific)
