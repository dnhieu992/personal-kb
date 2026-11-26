# 0002 — zod schemas in `packages/contracts` are the single source of truth

Every request/response shape and enum is a zod schema; the API validates with `ZodPipe(schema)`, the web
imports the inferred types. Pure helpers shared by both sides live there too (`dates.ts`, `position.ts`).
Adding an enum value in one place makes the compiler point at every place that needs it (fixes v1's
duplicated `knowledge.type`). Errors leave the API as RFC 7807 problem documents (`ProblemFilter`).
