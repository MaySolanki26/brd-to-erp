@AGENTS.md

## Claude Code workflow

- Always start in plan mode for new tasks; list files before editing.
- After edits run: pnpm lint && pnpm typecheck && pnpm test && pnpm build
- Never run git push. Never read or edit .env files.
- Commit only when I say "commit", using conventional commit messages.
