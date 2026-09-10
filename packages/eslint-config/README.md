# `@turbo/eslint-config`

Collection of internal eslint configurations.

## How it works

Workspace packages extend the shared configurations from this package instead of duplicating baseline lint rules. Run `bun run lint` from the repository root or from an application package to apply the relevant configuration. This package contains configuration only; it does not run a server or ship application code.
