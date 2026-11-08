---
name: expressive-react
description: React host for Expressive MVC (@expressive/react) - Component classes as React components, <Component for> providers, Model.get() in function components. Use when writing React views over Expressive state, migrating hooks (useState/useEffect/useMemo/useContext) to classes, fixing prop drilling, or reviewing such a refactor. Pair with the expressive-mvc skill for the core Model API.
---

# Expressive MVC - React

`@expressive/react` is the React host. Ownership decisions, the golden-path summary and the core API are in [expressive-mvc](../expressive-mvc/SKILL.md) - read it first. **Read [refactor.md](refactor.md) in full before any hook-migration or refactor task.**

- [refactor.md](refactor.md) - the refactor algorithm expanded: ownership triage, mechanical-setter and prop-drilling anti-patterns, single-consumer getters, dependency snapshots and conditional subscriptions, presence boundaries, restrained `is`, subcomponent overuse, extract-then-consolidate, review checklist
- [style.md](style.md) - style profile: snapshot formatting, affirmative conditions, render fallthrough vs operational guards
- [react.md](react.md) - Model.get() (optional lookup, presence boundaries, custom lookup), effects at commit, providing state, transparent writes, SSR, React Native, Vite hot reload
- [component.md](component.md) - Component class, props, children, extending a base, subcomponent extension points, Suspense, transitions, error boundaries
- [patterns.md](patterns.md) - Recipes: forms, async, domain-row and form-chip pools, region controls, router bridge, host-agnostic domain model + view adapter, presence boundary, contextual children, debounce, async effects, awaiting a pending value, effects
