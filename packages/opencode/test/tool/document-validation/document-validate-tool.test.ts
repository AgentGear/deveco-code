import { describe, expect, test } from "bun:test"
import { validateDocumentSimple } from "@/tool/document-validation/document-validate-tool"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"

function tempFile(content: string): string {
  const p = path.join(os.tmpdir(), `dv-test-${Date.now()}-${Math.random().toString(36).slice(2)}.md`)
  fs.writeFileSync(p, content, "utf-8")
  return p
}

describe("validateDocumentSimple: spec", () => {
  describe("valid full spec", () => {
    test("passes for valid spec", () => {
      const md = `# Feature Specification: Auth

## Overview

overview

## User Scenarios & Testing

story

## Requirements

reqs

## Success Criteria

criteria

## Assumptions

assumptions

## Open Questions

questions
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "spec")
      expect(result).toBe("")
    })
  })

  describe("valid spec with prefix", () => {
    test("passes with prefix match for H1", () => {
      const md = `# Feature Specification: User Authentication System

## Overview

## User Scenarios & Testing

## Requirements

## Success Criteria

## Assumptions

## Open Questions
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "spec")
      expect(result).toBe("")
    })
  })

  describe("invalid documents", () => {
    test("fails when missing required H2 section", () => {
      const md = `# Feature Specification: Auth

## Overview

## User Scenarios & Testing

## Requirements

## Success Criteria
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "spec")
      expect(result).toContain("Missing required sections")
      expect(result).toContain("Assumptions")
      expect(result).toContain("Open Questions")
    })

    test("fails when H1 title is wrong", () => {
      const md = `# Wrong Title

## Overview

## User Scenarios & Testing

## Requirements

## Success Criteria

## Assumptions

## Open Questions
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "spec")
      expect(result).toContain("Missing required sections")
      expect(result).toContain("Feature Specification:")
    })
  })
})

describe("validateDocumentSimple: design", () => {
  describe("valid design", () => {
    test("passes for valid plan", () => {
      const md = `# Implementation Plan: Auth

## Summary

summary

## Technical Context

tech

## Project Structure

structure

## Research & Decisions

research

## Data Model

model

## Contracts & Interfaces

contracts

## Quickstart

quick
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "design")
      expect(result).toBe("")
    })
  })

  describe("invalid design", () => {
    test("fails when missing multiple sections", () => {
      const md = `# Implementation Plan: Auth

## Summary

## Technical Context
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "design")
      expect(result).toContain("Missing required sections")
      expect(result).toContain("Project Structure")
      expect(result).toContain("Research & Decisions")
    })
  })
})

describe("validateDocumentSimple: tasks", () => {
  describe("valid basic", () => {
    test("passes for valid tasks", () => {
      const md = `# Tasks: Auth

## Format

format

## Path Conventions

paths

## Phase 1: Setup

- [ ] T001 do something

## Phase 2: Foundational

- [ ] T002 do more

## Dependencies & Execution Order

order

## Parallel Example

example

## Implementation Strategy

strategy

## Notes

notes
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "tasks")
      expect(result).toBe("")
    })
  })

  describe("valid many phases", () => {
    test("passes with many phases (high maxSectionLevel2)", () => {
      const md = `# Tasks: Auth

## Format

## Path Conventions

## Phase 1

## Phase 2

## Phase 3

## Phase 4

## Phase 5

## Phase 6

## Phase 7

## Phase 8

## Phase 9

## Phase 10

## Dependencies & Execution Order

## Parallel Example

## Implementation Strategy

## Notes
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "tasks")
      expect(result).toBe("")
    })
  })

  describe("valid prefix match", () => {
    test("passes with prefix match for H1", () => {
      const md = `# Tasks: User Authentication System

## Format

## Path Conventions

## Phase 1: Setup

## Dependencies & Execution Order

## Parallel Example

## Implementation Strategy

## Notes
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "tasks")
      expect(result).toBe("")
    })
  })

  describe("invalid documents", () => {
    test("fails when missing H1", () => {
      const md = `## Dependencies & Execution Order

order
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "tasks")
      expect(result).toContain("Missing required sections")
      expect(result).toContain("Tasks:")
    })

    test("fails when missing Dependencies & Execution Order", () => {
      const md = `# Tasks: Auth

## Format

## Path Conventions

## Phase 1

## Phase 2

## Parallel Example

## Implementation Strategy

## Notes
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "tasks")
      expect(result).toContain("Missing required sections")
      expect(result).toContain("Dependencies & Execution Order")
    })
  })
})

describe("validateDocumentSimple: spec missing individual sections", () => {
  const base = `
## User Scenarios & Testing

## Requirements

## Success Criteria

## Assumptions

## Open Questions
`

  describe("missing Overview and User Scenarios", () => {
    test("fails when missing Overview", () => {
      const md = `# Feature Specification: Auth${base}`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "spec")
      expect(result).toContain("Missing required sections")
      expect(result).toContain("Overview")
    })

    test("fails when missing User Scenarios & Testing", () => {
      const md = `# Feature Specification: Auth

## Overview

## Requirements

## Success Criteria

## Assumptions

## Open Questions
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "spec")
      expect(result).toContain("Missing required sections")
      expect(result).toContain("User Scenarios & Testing")
    })
  })

  describe("missing Requirements and Success Criteria", () => {
    test("fails when missing Requirements", () => {
      const md = `# Feature Specification: Auth

## Overview

## User Scenarios & Testing

## Success Criteria

## Assumptions

## Open Questions
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "spec")
      expect(result).toContain("Missing required sections")
      expect(result).toContain("Requirements")
    })

    test("fails when missing Success Criteria", () => {
      const md = `# Feature Specification: Auth

## Overview

## User Scenarios & Testing

## Requirements

## Assumptions

## Open Questions
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "spec")
      expect(result).toContain("Missing required sections")
      expect(result).toContain("Success Criteria")
    })
  })
})

describe("validateDocumentSimple: design missing individual sections", () => {
  const base = `
## Technical Context

## Project Structure

## Research & Decisions

## Data Model

## Contracts & Interfaces

## Quickstart
`

  describe("missing Summary and Technical Context", () => {
    test("fails when missing Summary", () => {
      const md = `# Implementation Plan: Auth${base}`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "design")
      expect(result).toContain("Missing required sections")
      expect(result).toContain("Summary")
    })

    test("fails when missing Technical Context", () => {
      const md = `# Implementation Plan: Auth

## Summary

## Project Structure

## Research & Decisions

## Data Model

## Contracts & Interfaces

## Quickstart
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "design")
      expect(result).toContain("Missing required sections")
      expect(result).toContain("Technical Context")
    })
  })

  describe("missing Project Structure and Research", () => {
    test("fails when missing Project Structure", () => {
      const md = `# Implementation Plan: Auth

## Summary

## Technical Context

## Research & Decisions

## Data Model

## Contracts & Interfaces

## Quickstart
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "design")
      expect(result).toContain("Missing required sections")
      expect(result).toContain("Project Structure")
    })

    test("fails when missing Research & Decisions", () => {
      const md = `# Implementation Plan: Auth

## Summary

## Technical Context

## Project Structure

## Data Model

## Contracts & Interfaces

## Quickstart
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "design")
      expect(result).toContain("Missing required sections")
      expect(result).toContain("Research & Decisions")
    })
  })

  describe("missing Data Model and Contracts", () => {
    test("fails when missing Data Model", () => {
      const md = `# Implementation Plan: Auth

## Summary

## Technical Context

## Project Structure

## Research & Decisions

## Contracts & Interfaces

## Quickstart
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "design")
      expect(result).toContain("Missing required sections")
      expect(result).toContain("Data Model")
    })

    test("fails when missing Contracts & Interfaces", () => {
      const md = `# Implementation Plan: Auth

## Summary

## Technical Context

## Project Structure

## Research & Decisions

## Data Model

## Quickstart
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "design")
      expect(result).toContain("Missing required sections")
      expect(result).toContain("Contracts & Interfaces")
    })
  })

  describe("missing Quickstart", () => {
    test("fails when missing Quickstart", () => {
      const md = `# Implementation Plan: Auth

## Summary

## Technical Context

## Project Structure

## Research & Decisions

## Data Model

## Contracts & Interfaces
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "design")
      expect(result).toContain("Missing required sections")
      expect(result).toContain("Quickstart")
    })
  })

  describe("prefix match", () => {
    test("passes with prefix match for H1", () => {
      const md = `# Implementation Plan: User Authentication System

## Summary

## Technical Context

## Project Structure

## Research & Decisions

## Data Model

## Contracts & Interfaces

## Quickstart
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "design")
      expect(result).toBe("")
    })
  })
})

describe("validateDocumentSimple: tasks missing individual sections", () => {
  const base = `
## Path Conventions

## Phase 1: Setup

## Dependencies & Execution Order

## Parallel Example

## Implementation Strategy

## Notes
`

  describe("missing Format and Path Conventions", () => {
    test("fails when missing Format", () => {
      const md = `# Tasks: Auth${base}`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "tasks")
      expect(result).toContain("Missing required sections")
      expect(result).toContain("Format")
    })

    test("fails when missing Path Conventions", () => {
      const md = `# Tasks: Auth

## Format

## Phase 1: Setup

## Dependencies & Execution Order

## Parallel Example

## Implementation Strategy

## Notes
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "tasks")
      expect(result).toContain("Missing required sections")
      expect(result).toContain("Path Conventions")
    })
  })

  describe("missing Dependencies and Parallel Example", () => {
    test("fails when missing Dependencies & Execution Order", () => {
      const md = `# Tasks: Auth

## Format

## Path Conventions

## Phase 1: Setup

## Parallel Example

## Implementation Strategy

## Notes
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "tasks")
      expect(result).toContain("Missing required sections")
      expect(result).toContain("Dependencies & Execution Order")
    })

    test("fails when missing Parallel Example", () => {
      const md = `# Tasks: Auth

## Format

## Path Conventions

## Phase 1: Setup

## Dependencies & Execution Order

## Implementation Strategy

## Notes
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "tasks")
      expect(result).toContain("Missing required sections")
      expect(result).toContain("Parallel Example")
    })
  })

  describe("missing Implementation Strategy and Notes", () => {
    test("fails when missing Implementation Strategy", () => {
      const md = `# Tasks: Auth

## Format

## Path Conventions

## Phase 1: Setup

## Dependencies & Execution Order

## Parallel Example

## Notes
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "tasks")
      expect(result).toContain("Missing required sections")
      expect(result).toContain("Implementation Strategy")
    })

    test("fails when missing Notes", () => {
      const md = `# Tasks: Auth

## Format

## Path Conventions

## Phase 1: Setup

## Dependencies & Execution Order

## Parallel Example

## Implementation Strategy
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "tasks")
      expect(result).toContain("Missing required sections")
      expect(result).toContain("Notes")
    })
  })
})

describe("validateDocumentSimple: aliases", () => {
  describe("spec and design aliases", () => {
    test("accepts Chinese aliases for spec sections", () => {
      const md = `# Feature Specification: Auth

## 概述

## 用户场景与测试

## 需求

## 成功标准

## 假设

## 开放问题
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "spec")
      expect(result).toBe("")
    })

    test("accepts Chinese aliases for design sections", () => {
      const md = `# 实现计划: Auth

## 摘要

## 技术背景

## 项目结构

## 研究与决策

## 数据模型

## 契约与接口

## 快速开始
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "design")
      expect(result).toBe("")
    })
  })

  describe("tasks aliases", () => {
    test("accepts Chinese aliases for tasks sections", () => {
      const md = `# 任务: Auth

## 格式

## 路径约定

## Phase 1: 设置

## 依赖与执行顺序

## 并行示例

## 实现策略

## 备注
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "tasks")
      expect(result).toBe("")
    })
  })
})

describe("validateDocumentSimple: extra sections", () => {
  describe("extra", () => {
    test("reports extra level-2 sections for spec", () => {
      const md = `# Feature Specification: Auth

## Overview

## User Scenarios & Testing

## Requirements

## Success Criteria

## Assumptions

## Open Questions

## Extra One

## Extra Two

## Extra Three

content
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "spec")
      expect(result).toContain("Extra sections")
      expect(result).toContain("Extra One")
      expect(result).toContain("Extra Two")
      expect(result).toContain("Extra Three")
    })
  })

  describe("duplicate", () => {
    test("reports duplicate sections for spec", () => {
      const md = `# Feature Specification: Auth

## Overview

## User Scenarios & Testing

## Requirements

## Success Criteria

## Assumptions

## Open Questions

## Overview

## Requirements
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "spec")
      expect(result).toContain("Duplicate sections")
      expect(result).toContain("Overview")
      expect(result).toContain("Requirements")
    })
  })
})

describe("validateDocumentSimple: design extra & duplicate", () => {
  describe("extra", () => {
    test("reports extra level-2 sections for design", () => {
      const md = `# Implementation Plan: Auth

## Summary

## Technical Context

## Project Structure

## Research & Decisions

## Data Model

## Contracts & Interfaces

## Quickstart

## Random Section

## Another Extra
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "design")
      expect(result).toContain("Extra sections")
      expect(result).toContain("Random Section")
      expect(result).toContain("Another Extra")
    })
  })

  describe("optional", () => {
    test("allows optional sections Complexity Tracking and Changelog", () => {
      const md = `# Implementation Plan: Auth

## Summary

## Technical Context

## Project Structure

## Complexity Tracking

## Research & Decisions

## Data Model

## Contracts & Interfaces

## Quickstart

## Changelog
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "design")
      expect(result).toBe("")
    })
  })

  describe("invalid", () => {
    test("fails when missing H1 for design", () => {
      const md = `## Summary

## Technical Context
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "design")
      expect(result).toContain("Missing required sections")
      expect(result).toContain("Implementation Plan:")
    })

    test("reports duplicate sections for design", () => {
      const md = `# Implementation Plan: Auth

## Summary

## Technical Context

## Project Structure

## Research & Decisions

## Data Model

## Contracts & Interfaces

## Quickstart

## Summary

## Data Model
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "design")
      expect(result).toContain("Duplicate sections")
      expect(result).toContain("Summary")
      expect(result).toContain("Data Model")
    })
  })
})

describe("validateDocumentSimple: tasks optional sections", () => {
  const base = `
## Format

## Path Conventions

## Phase 1: Setup

## Dependencies & Execution Order

## Parallel Example

## Implementation Strategy

## Notes
`

  describe("emoji sections", () => {
    test("allows emoji Dependency Graph section", () => {
      const md = `# Tasks: Auth${base}

## 📊 Dependency Graph

graph
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "tasks")
      expect(result).toBe("")
    })

    test("allows emoji Parallel Execution Guide section", () => {
      const md = `# Tasks: Auth${base}

## ⚡ Parallel Execution Guide

guide
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "tasks")
      expect(result).toBe("")
    })
  })

  describe("Parallel Example variants", () => {
    test("allows Parallel Example with suffix via prefix match", () => {
      const md = `# Tasks: Auth

## Format

## Path Conventions

## Phase 1: Setup

## Dependencies & Execution Order

## Parallel Example: User Stories 1 & 2 & 4

example

## Implementation Strategy

## Notes
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "tasks")
      expect(result).toBe("")
    })

    test("allows Parallel Examples (plural) as alias for Parallel Example", () => {
      const md = `# Tasks: Auth

## Format

## Path Conventions

## Phase 1: Setup

## Dependencies & Execution Order

## Parallel Examples

examples

## Implementation Strategy

## Notes
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "tasks")
      expect(result).toBe("")
    })
  })
})

describe("validateDocumentSimple: tasks extra & duplicate", () => {
  describe("extra", () => {
    test("reports extra non-Phase level-2 sections for tasks", () => {
      const md = `# Tasks: Auth

## Format

## Path Conventions

## Phase 1: Setup

## Dependencies & Execution Order

## Parallel Example

## Implementation Strategy

## Notes

## Random Extra
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "tasks")
      expect(result).toContain("Extra sections")
      expect(result).toContain("Random Extra")
    })
  })

  describe("duplicate", () => {
    test("reports duplicate sections for tasks", () => {
      const md = `# Tasks: Auth

## Format

## Path Conventions

## Phase 1: Setup

## Dependencies & Execution Order

## Parallel Example

## Implementation Strategy

## Notes

## Format

## Phase 2: Foundational

## Notes
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "tasks")
      expect(result).toContain("Duplicate sections")
      expect(result).toContain("Format")
      expect(result).toContain("Notes")
    })
  })

  describe("missing multiple", () => {
    test("fails when missing multiple required sections for tasks", () => {
      const md = `# Tasks: Auth

## Format

## Path Conventions
`
      const p = tempFile(md)
      const result = validateDocumentSimple(p, "tasks")
      expect(result).toContain("Missing required sections")
      expect(result).toContain("Dependencies & Execution Order")
      expect(result).toContain("Parallel Example")
      expect(result).toContain("Implementation Strategy")
      expect(result).toContain("Notes")
    })
  })
})

describe("validateDocumentSimple: tasks Phase boundary", () => {
  const base = `
## Format

## Path Conventions

## Dependencies & Execution Order

## Parallel Example

## Implementation Strategy

## Notes
`

  test("rejects ## Phase without trailing content as extra", () => {
    const md = `# Tasks: Auth

## Phase
${base}`
    const p = tempFile(md)
    const result = validateDocumentSimple(p, "tasks")
    expect(result).toContain("Extra sections")
    expect(result).toContain("Phase")
  })

  test("accepts ## Phase X with letter suffix", () => {
    const md = `# Tasks: Auth

## Phase X: Setup
${base}`
    const p = tempFile(md)
    const result = validateDocumentSimple(p, "tasks")
    expect(result).toBe("")
  })

  test("rejects ## Phase1 without space as extra", () => {
    const md = `# Tasks: Auth

## Phase1: Setup
${base}`
    const p = tempFile(md)
    const result = validateDocumentSimple(p, "tasks")
    expect(result).toContain("Extra sections")
    expect(result).toContain("Phase1")
  })

  test("accepts ## Phase 0", () => {
    const md = `# Tasks: Auth

## Format

## Path Conventions

## Phase 0: Preparation

## Dependencies & Execution Order

## Parallel Example

## Implementation Strategy

## Notes
`
    const p = tempFile(md)
    const result = validateDocumentSimple(p, "tasks")
    expect(result).toBe("")
  })

  test("accepts ## Phase 100", () => {
    const md = `# Tasks: Auth

## Format

## Path Conventions

## Phase 100: Final

## Dependencies & Execution Order

## Parallel Example

## Implementation Strategy

## Notes
`
    const p = tempFile(md)
    const result = validateDocumentSimple(p, "tasks")
    expect(result).toBe("")
  })
})

describe("validateDocumentSimple: spec missing Assumptions and Open Questions", () => {
  const base = `
## Overview

## User Scenarios & Testing

## Requirements

## Success Criteria
`

  test("fails when missing Assumptions", () => {
    const md = `# Feature Specification: Auth${base}

## Open Questions
`
    const p = tempFile(md)
    const result = validateDocumentSimple(p, "spec")
    expect(result).toContain("Missing required sections")
    expect(result).toContain("Assumptions")
  })

  test("fails when missing Open Questions", () => {
    const md = `# Feature Specification: Auth${base}

## Assumptions
`
    const p = tempFile(md)
    const result = validateDocumentSimple(p, "spec")
    expect(result).toContain("Missing required sections")
    expect(result).toContain("Open Questions")
  })
})

describe("validateDocumentSimple: empty and minimal documents", () => {
  test("fails for empty document", () => {
    const p = tempFile("")
    const result = validateDocumentSimple(p, "spec")
    expect(result).toContain("Missing required sections")
  })

  test("fails for document with only newlines", () => {
    const p = tempFile("\n\n\n")
    const result = validateDocumentSimple(p, "spec")
    expect(result).toContain("Missing required sections")
  })

  test("fails for document with only plain text", () => {
    const p = tempFile("just some plain text without headers")
    const result = validateDocumentSimple(p, "spec")
    expect(result).toContain("Missing required sections")
  })
})

describe("validateDocumentSimple: combined errors", () => {
  test("reports missing, extra, and duplicate sections together", () => {
    const md = `# Feature Specification: Auth

## Overview

## User Scenarios & Testing

## Requirements

## Success Criteria

## Assumptions

## Overview

## Extra One

## Extra Two
`
    const p = tempFile(md)
    const result = validateDocumentSimple(p, "spec")
    expect(result).toContain("Missing required sections")
    expect(result).toContain("Open Questions")
    expect(result).toContain("Duplicate sections")
    expect(result).toContain("Overview")
    expect(result).toContain("Extra sections")
    expect(result).toContain("Extra One")
    expect(result).toContain("Extra Two")
  })

  test("reports missing sections together with tooManyLevel2", () => {
    const md = `# Feature Specification: Auth

## Overview

## User Scenarios & Testing

## Requirements

## Success Criteria

## Assumptions

## Bonus One

## Bonus Two
`
    const p = tempFile(md)
    const result = validateDocumentSimple(p, "spec")
    expect(result).toContain("Missing required sections")
    expect(result).toContain("Open Questions")
    expect(result).toContain("Too many level-2 sections")
    expect(result).toContain("Extra sections")
    expect(result).toContain("Bonus One")
  })
})

describe("validateDocumentSimple: maxSectionLevel2", () => {
  test("spec fails when level-2 sections exceed 6", () => {
    const md = `# Feature Specification: Auth

## Overview

## User Scenarios & Testing

## Requirements

## Success Criteria

## Assumptions

## Open Questions

## Bonus One

## Bonus Two
`
    const p = tempFile(md)
    const result = validateDocumentSimple(p, "spec")
    expect(result).toContain("Too many level-2 sections")
  })

  test("design fails when level-2 sections exceed 10", () => {
    const sections = [
      "Summary",
      "Technical Context",
      "Project Structure",
      "Complexity Tracking",
      "Research & Decisions",
      "Data Model",
      "Contracts & Interfaces",
      "Quickstart",
      "Changelog",
      "Extra A",
      "Extra B",
    ]
    const body = sections.map((s) => `## ${s}\n\ncontent`).join("\n\n")
    const md = `# Implementation Plan: Auth\n\n${body}`
    const p = tempFile(md)
    const result = validateDocumentSimple(p, "design")
    expect(result).toContain("Too many level-2 sections")
  })

  test("tasks passes with 49 level-2 sections (under limit)", () => {
    const phases = Array.from({ length: 43 }, (_, i) => `## Phase ${i + 1}\n\ncontent`)
    const required = [
      "Format",
      "Path Conventions",
      "Dependencies & Execution Order",
      "Parallel Example",
      "Implementation Strategy",
      "Notes",
    ]
    const all = [...required.map((s) => `## ${s}\n\ncontent`), ...phases]
    const md = `# Tasks: Auth\n\n${all.join("\n\n")}`
    const p = tempFile(md)
    const result = validateDocumentSimple(p, "tasks")
    expect(result).toBe("")
  })

  test("tasks fails with 51 level-2 sections (over limit)", () => {
    const phases = Array.from({ length: 45 }, (_, i) => `## Phase ${i + 1}\n\ncontent`)
    const required = [
      "Format",
      "Path Conventions",
      "Dependencies & Execution Order",
      "Parallel Example",
      "Implementation Strategy",
      "Notes",
    ]
    const all = [...required.map((s) => `## ${s}\n\ncontent`), ...phases]
    const md = `# Tasks: Auth\n\n${all.join("\n\n")}`
    const p = tempFile(md)
    const result = validateDocumentSimple(p, "tasks")
    expect(result).toContain("Too many level-2 sections")
  })
})

describe("validateDocumentSimple: level-3+ sections are ignored", () => {
  test("ignores level-3 sections in spec validation", () => {
    const md = `# Feature Specification: Auth

## Overview

### Deep nested

## User Scenarios & Testing

## Requirements

## Success Criteria

## Assumptions

## Open Questions
`
    const p = tempFile(md)
    const result = validateDocumentSimple(p, "spec")
    expect(result).toBe("")
  })
})

describe("validateDocumentSimple: case-insensitive H1", () => {
  test("accepts lowercase feature specification prefix", () => {
    const md = `# feature specification: Auth

## Overview

## User Scenarios & Testing

## Requirements

## Success Criteria

## Assumptions

## Open Questions
`
    const p = tempFile(md)
    const result = validateDocumentSimple(p, "spec")
    expect(result).toBe("")
  })
})
