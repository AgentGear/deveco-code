---
name: arkui-knowledge
description: Best practices for implementing HarmonyOS UI components with ArkUI declarative syntax.
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
