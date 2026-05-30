export interface RequiredSection {
  level: number
  standardTitle: string
  ruleId: string
  message: string
  suggestion: string
}

interface DocumentFormatRules {
  requiredSections: RequiredSection[]
  allowedSections: string[]
  maxSectionLevel2: number
}

export const FORMAT_RULES: Record<string, DocumentFormatRules> = {
  spec: {
    requiredSections: [
      {
        level: 1,
        standardTitle: "Feature Specification:",
        ruleId: "SPEC-TITLE",
        message: "Missing '# Feature Specification: ...' title",
        suggestion: "Add '# Feature Specification: <feature name>'",
      },
      {
        level: 2,
        standardTitle: "Overview",
        ruleId: "SPEC-SEC-0",
        message: "Missing '## Overview'",
        suggestion: "Add '## Overview'",
      },
      {
        level: 2,
        standardTitle: "User Scenarios & Testing",
        ruleId: "SPEC-SEC-1",
        message: "Missing '## User Scenarios & Testing'",
        suggestion: "Add '## User Scenarios & Testing'",
      },
      {
        level: 2,
        standardTitle: "Requirements",
        ruleId: "SPEC-SEC-2",
        message: "Missing '## Requirements'",
        suggestion: "Add '## Requirements'",
      },
      {
        level: 2,
        standardTitle: "Success Criteria",
        ruleId: "SPEC-SEC-3",
        message: "Missing '## Success Criteria'",
        suggestion: "Add '## Success Criteria'",
      },
      {
        level: 2,
        standardTitle: "Assumptions",
        ruleId: "SPEC-SEC-4",
        message: "Missing '## Assumptions'",
        suggestion: "Add '## Assumptions'",
      },
      {
        level: 2,
        standardTitle: "Open Questions",
        ruleId: "SPEC-SEC-5",
        message: "Missing '## Open Questions'",
        suggestion: "Add '## Open Questions'",
      },
    ],
    allowedSections: [
      "Feature Specification:",
      "Overview",
      "User Scenarios & Testing",
      "Requirements",
      "Success Criteria",
      "Assumptions",
      "Open Questions",
    ],
    maxSectionLevel2: 6,
  },
  design: {
    requiredSections: [
      {
        level: 1,
        standardTitle: "Implementation Plan:",
        ruleId: "DES-TITLE",
        message: "Missing '# Implementation Plan: ...' title",
        suggestion: "Add '# Implementation Plan: <feature name>'",
      },
      {
        level: 2,
        standardTitle: "Summary",
        ruleId: "DES-SEC-1",
        message: "Missing '## Summary'",
        suggestion: "Add '## Summary'",
      },
      {
        level: 2,
        standardTitle: "Technical Context",
        ruleId: "DES-SEC-2",
        message: "Missing '## Technical Context'",
        suggestion: "Add '## Technical Context'",
      },
      {
        level: 2,
        standardTitle: "Project Structure",
        ruleId: "DES-SEC-3",
        message: "Missing '## Project Structure'",
        suggestion: "Add '## Project Structure'",
      },
      {
        level: 2,
        standardTitle: "Research & Decisions",
        ruleId: "DES-SEC-4",
        message: "Missing '## Research & Decisions'",
        suggestion: "Add '## Research & Decisions'",
      },
      {
        level: 2,
        standardTitle: "Data Model",
        ruleId: "DES-SEC-5",
        message: "Missing '## Data Model'",
        suggestion: "Add '## Data Model'",
      },
      {
        level: 2,
        standardTitle: "Contracts & Interfaces",
        ruleId: "DES-SEC-6",
        message: "Missing '## Contracts & Interfaces'",
        suggestion: "Add '## Contracts & Interfaces'",
      },
    ],
    allowedSections: [
      "Implementation Plan:",
      "Summary",
      "Technical Context",
      "Project Structure",
      "Complexity Tracking",
      "Research & Decisions",
      "Data Model",
      "Contracts & Interfaces",
      "Quickstart",
      "Changelog",
    ],
    maxSectionLevel2: 10,
  },
  tasks: {
    requiredSections: [
      {
        level: 1,
        standardTitle: "Tasks:",
        ruleId: "TSK-TITLE",
        message: "Missing '# Tasks: ...' title",
        suggestion: "Add '# Tasks: <feature name>'",
      },
      {
        level: 2,
        standardTitle: "Format",
        ruleId: "TSK-SEC-1",
        message: "Missing '## Format'",
        suggestion: "Add '## Format'",
      },
      {
        level: 2,
        standardTitle: "Path Conventions",
        ruleId: "TSK-SEC-2",
        message: "Missing '## Path Conventions'",
        suggestion: "Add '## Path Conventions'",
      },
      {
        level: 2,
        standardTitle: "Dependencies & Execution Order",
        ruleId: "TSK-SEC-3",
        message: "Missing '## Dependencies & Execution Order'",
        suggestion: "Add '## Dependencies & Execution Order'",
      },
      {
        level: 2,
        standardTitle: "Parallel Example",
        ruleId: "TSK-SEC-4",
        message: "Missing '## Parallel Example'",
        suggestion: "Add '## Parallel Example'",
      },
      {
        level: 2,
        standardTitle: "Implementation Strategy",
        ruleId: "TSK-SEC-5",
        message: "Missing '## Implementation Strategy'",
        suggestion: "Add '## Implementation Strategy'",
      },
      {
        level: 2,
        standardTitle: "Notes",
        ruleId: "TSK-SEC-6",
        message: "Missing '## Notes'",
        suggestion: "Add '## Notes'",
      },
    ],
    allowedSections: [
      "Tasks:",
      "Format",
      "Path Conventions",
      "Dependencies & Execution Order",
      "Parallel Example",
      "Implementation Strategy",
      "Notes",
      "Dependency Graph",
      "Parallel Execution Guide",
      "Summary Report",
    ],
    maxSectionLevel2: 50,
  },
} as const
