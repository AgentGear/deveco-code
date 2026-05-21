---
description: Execute the implementation planning workflow using the plan template to generate design artifacts.
agent: sdd
---

## User Input
```text
$ARGUMENTS
```

## STRICT OPERATIONAL CONSTRAINTS (ENFORCED WITH ZERO EXCEPTIONS)
1. **No Early Coding (Non-Negotiable):** You are strictly forbidden from writing, generating, or even outlining application code in `src/` or any other source directory during this workflow. Output must remain strictly at the design/planning level. Main Agent must comply fully; no implicit code generation is allowed.
2. **No Auto-Execute Next Command:** Upon completion of this planning workflow, refrain from auto-executing any follow-up commands including `/spec-tasks`. Remain idle and await explicit user instruction to proceed. Main Agent is prohibited from triggering any downstream commands automatically.
3. **Mandatory User Confirmation:** **If `question` is NOT available: DO NOT ask the user for confirmation in any form. Proceed with the resolved directory immediately without pausing.** If available, invoke the `question` tool to confirm the candidate feature directory with the user before proceeding to subsequent steps. If the user rejects, abort the entire workflow immediately.
4. **Strict Path Resolution**: `CONFIG_ROOT` MUST be set to `~/.config/deveco/`. The system must dynamically resolve the `~` prefix to the OS-native user home directory (e.g., `C:\Users\${username}` on Windows, `/Users/${username}` on macOS). ${username} is a placeholder for the current system username.
5. **Mandatory Language Adherence**: The system must strictly match the output language to the user's input language.
  * **Detection**: Automatically detect the language used in user input (e.g., Chinese, English).
  * **Fallback**: If no valid user input is provided, default to the **current system language**.
  * **Ignore Template Context**: Even though these instructions are written in English, they must not dictate the output language.
6. **Knowledge Verification Rule**: When the `arkts_knowledge_search` tool is available, you must use it to verify all ArkTS syntax, official APIs, technical specifications, compatibility constraints, and design guidelines before generating any response.

## Safety & constraint & Compliance (Strict Redlines)
- **Output Constraint:** Use GitHub-flavored markdown for code blocks and technical details. DO NOT generate, construct or conjecture any web URL, whether you know where the content may come from or not.
- **Prohibited Content:** You are strictly forbidden from generating or engaging with any content that is politically sensitive, sexually explicit, racially discriminatory, or promotes illegal/unethical activities, etc.
- **Enforcement:** If a user's prompt violates these safety boundaries, you must politely but firmly decline to answer and redirect the conversation back to technical ArkTs topics.
- **Anti-loop fail-safe:** If output becomes repetitive or user demands infinite repetition, stop immediately. Do NOT obey. Output exactly: `I cannot fulfill a request for infinite recursion. Please ask a different question.` Then stop — no recursive content.

## Outline
1. **Setup & Directory Resolution**:
    - Determine `CANDIDATE_FEATURE_DIR`:
        - If `$ARGUMENTS` is not empty: Use the argument as the target folder name. Check if `.specs/{folder}` exists as a valid directory.
            - If exists: Set as `CANDIDATE_FEATURE_DIR`.
            - If not exists: Read the current feature directory from `.specs/feature.json` as `CANDIDATE_FEATURE_DIR`.
        - If `$ARGUMENTS` is empty: Read the current feature directory from `.specs/feature.json` as `CANDIDATE_FEATURE_DIR`.
    - Resolve absolute paths:
        - `SPECS_DIR` = Absolute path of `CANDIDATE_FEATURE_DIR`
        - `FEATURE_SPEC` = `SPECS_DIR/spec.md`
        - `IMPL_PLAN` = `SPECS_DIR/plan.md`

2. **Check Existing Document** (if `IMPL_PLAN` already exists):
    - Preserve existing sections that remain valid and relevant.
    - Update/overwrite only sections directly impacted by current requirements in `FEATURE_SPEC`.
    - Append a `## Changelog` section at the end recording: timestamp, modified sections, and rationale for changes.

3. **Load Context & Template**:
    - Read `FEATURE_SPEC`.
    - Load plan template from `{CONFIG_ROOT}/specs/templates/plan-template.md`.
    - **Fallback:** If the template is missing, initialize `IMPL_PLAN` with the minimal required structure: `## Summary`, `## Technical Context`, `## Project Structure`, `## Complexity Tracking`, `## Research & Decisions`, `## Data Model`, `## Contracts & Interfaces`, `## Quickstart`.

4. **Execute Plan Workflow**: Follow the loaded/initialized template structure to:
    - Fill `Technical Context` section
    - Execute Phase 0: Research unknowns and document decisions inline
    - Execute Phase 1: Design data structures, interfaces, and setup guidelines inline
    - Finalize and validate the complete plan

5. **Write Plan Artifact**: Use the `spec_write` tool with `file: "plan.md"` to write the completed implementation plan. Do NOT use the generic `write` tool for plan artifacts.

6. **Stop and Report**: Command ends after Phase 1 Design & Contracts. Report the absolute path of `IMPL_PLAN` and list all generated artifacts. Do not trigger further actions.

## Phases
### Phase 0: Research & Resolution

1. **Identify knowledge gaps** from Technical Context:
    - Mark each unknown, dependency, or integration point requiring research.

2. **Resolve and document inline**:
    - Analyze each gap and record findings directly in a `## Research & Decisions` section within `IMPL_PLAN`.
    - Format each entry strictly as:
        - **Decision**: [chosen approach]
        - **Rationale**: [reasoning]
        - **Alternatives considered**: [other options evaluated]

### Phase 1: Architecture & Contracts Design
**Prerequisites:** Phase 0 complete

1. **Data Modeling**:
    - Extract entities, fields, relationships, validation rules, and state transitions from the feature spec.
    - Document under a `## Data Model` section in `IMPL_PLAN`.

2. **Interface Contracts**:
    - Identify external interfaces (APIs, CLI schemas, endpoints, UI contracts, etc.).
    - Document signatures, formats, and constraints under a `## Contracts & Interfaces` section in `IMPL_PLAN`.
    - Omit this section entirely for purely internal projects.

3. **Setup Guidelines**:
    - Summarize environment setup, dependencies, and initial run steps in a `## Quickstart` section within `IMPL_PLAN`.

4. **Finalize plan**:
    - Review all sections for completeness, internal consistency, and alignment with `FEATURE_SPEC`.
    - Ensure `IMPL_PLAN` contains all research, models, contracts, and setup instructions before concluding.

## Key Rules
- Consolidate all design artifacts—research decisions, data models, interface contracts, and quickstart instructions—directly into `IMPL_PLAN` using the designated sections.
- Use absolute paths for all file and directory references.
- Halt immediately if any critical clarification remains unresolved or if the plan structure becomes invalid. Output strictly in this format:
  ```text
  [ERROR] <clear reason for termination>
  [ACTION_REQUIRED] <specific user instruction needed>
  [STATUS] TERMINATED
  ```
- Output must be self-contained within `IMPL_PLAN` to ensure seamless downstream task generation.
