# ArkTS Basic Syntax

This file summarizes high-value ArkTS syntax guidance for common authoring and review questions.

## Variables

- Use `let` or `const` for variable declarations.
- Prefer `const` when the binding does not change.
- Keep types explicit when inference would be unclear.

Reference:
- Guide: `docs/ArkTS-Language-Guide/02-Basic-Syntax/*`
- Linter summary: declaration section and `arkts-no-var`

## Classes

- Prefer named `class` declarations.
- Declare fields in the class body.
- Use constructors to establish valid state.
- Prefer constructing instances with `new` instead of treating classes as loose object shapes.

Reference:
- Guide: `docs/ArkTS-Language-Guide/02-Basic-Syntax/classes.md`

## Interfaces

- Use named interfaces for reusable contracts.
- Prefer interface or class names over inline object type declarations.
- Use `implements` to make class contracts explicit.

Reference:
- Guide: `docs/ArkTS-Language-Guide/02-Basic-Syntax/interfaces.md`

## Functions

- Prefer arrow functions for function values.
- Keep return types explicit when the result is not obvious.
- Use top-level or class methods for reusable logic instead of nested local function declarations.

Reference:
- Guide: `docs/ArkTS-Language-Guide/02-Basic-Syntax/functions.md`
- Linter summary: function declaration section

## Operators

- Use normal arithmetic, comparison, logical, and conditional operators with explicit types.
- Prefer `===` and `!==`.
- Use explicit conversions instead of JavaScript-style coercion.

Reference:
- Guide: `docs/ArkTS-Language-Guide/02-Basic-Syntax/advanced-operators.md`

## Object modeling

- Prefer named classes and interfaces for stable data models.
- Use object literals only when there is clear explicit type context.
- Prefer direct property access with known names.

Reference:
- Guide: `docs/ArkTS-Language-Guide/02-Basic-Syntax/classes.md`
- Guide: `docs/ArkTS-Language-Guide/02-Basic-Syntax/interfaces.md`
- Linter summary: object literal section
