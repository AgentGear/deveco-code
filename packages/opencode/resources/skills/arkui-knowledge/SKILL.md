---
name: arkui-knowledge
description: MUST load this skill when writing or modifying ArkUI UI code, state decorators, rendering control, component APIs, or ArkUI declarative UI in .ets files.
---

# Harmony UI Implementation Skill

## Description

Best practices for implementing HarmonyOS UI components with ArkUI declarative syntax.

## Instructions

When building UI components:

1. **Layout**: Use `Column`, `Row`, `Stack`, `Flex`, `Grid`, and `List` for layout. Avoid absolute positioning.
2. **Responsive Design**: Use `vp` units, percentage widths, and `GridRow` / `GridCol` for responsive layouts.
3. **Navigation**: Use `Navigation`, `NavRouter`, and `NavDestination` for page routing.
4. **State Management**:
   - Use `@State` for component-local state.
   - Use `@Prop` for one-way parent-to-child binding.
   - Use `@Link` for two-way binding.
   - Use `@Provide` / `@Consume` for cross-component state sharing.
   - Use `AppStorage` for global persistent state.
5. **Animation**: Use `animateTo()` for property animations and `.transition()` for enter/exit effects.
6. **Custom Components**: Create custom components with the `@Component` decorator, and expose reusable UI blocks with `@Builder`.
7. **Performance**:
   - Use `LazyForEach` with `IDataSource` for large lists.
   - Minimize the scope of `@State` to reduce re-renders.
   - Use `@Reusable` for components that are frequently created and destroyed.

## Compile guardrails

- Place `@State`, `@Prop`, `@Link`, `@Provide`, `@Consume`, and similar ArkUI state decorators only on member declarations inside a `struct` decorated with `@Component` or another supported ArkUI component decorator.
- Do not put ArkUI state decorators on plain classes, top-level variables, local variables, or standalone helper declarations.
- `ForEach` key generator functions must return a stable string value. Do not use a block body that performs work but returns `void`.
- Use `LazyForEach` with a proper `IDataSource` implementation for large or lazy-rendered data. Use `ForEach` for ordinary arrays when lazy data loading is not needed.
- Do not invent component modifier APIs. Before using a modifier, make sure it belongs to that component; for example, layout alignment modifiers differ by component type.
- Keep UI component callbacks and builders typed explicitly when inference is unclear, especially for list item models and event parameters.
