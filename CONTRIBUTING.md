# Contributing

Keep each skill useful on its own. A contributor should be able to copy `skills/<slug>/` into an agent's skill directory and run its documented workflow without files elsewhere in this repository.

## Add or change a skill

- Use a lowercase, hyphenated folder name that matches the `name` in `SKILL.md` frontmatter.
- Describe the concrete capability and when to use it in the frontmatter `description`.
- Keep the entrypoint short. Put optional implementation detail in linked `references/` files, repeated executable work in `scripts/`, and output assets in `assets/`.
- Include the dependencies and license notices needed by the copied folder. Keep machine-specific paths, credentials, private context, and unrelated project assets out of examples.
- Add the skill to the README table. Prefer an ordinary folder over a shared framework until a demonstrated need justifies one.

For `animate-ascii-wordmark`, preserve the animation invariants in [references/animation.md](skills/animate-ascii-wordmark/references/animation.md). Changes to the runtime or command interface must update the instructions and integration examples in the same contribution.

## Validate your change

Install the repository dependencies with `npm ci` and Chromium with `npx playwright install chromium`, then run:

```bash
npm test
npm run check
npm run test:browser
```

The checks cover runtime tests, skill structure, and browser behavior. For runtime or rendering changes, follow the generation and export instructions in [SKILL.md](skills/animate-ascii-wordmark/SKILL.md) to check a fresh wordmark; GIF export needs `ffmpeg`.

Review the actual browser render and exported media in dark and light themes. Check readable letterforms, a seamless loop, transparent edges, reduced motion, and a narrow viewport. Verify that copying the skill to a temporary folder still supports the documented commands. Documentation-only changes need accurate links, filenames, and command examples, rather than new behavior tests.

Keep generated experiments out of version control. Commit only deliberate sample outputs and the files needed for the change. Explain the observable behavior, the validation performed, and any remaining limitation in the pull request.

## Installation and discovery

Keep the README focused on asking an agent to install and use a skill. Runtime setup and direct script commands belong in the skill instructions; development checks belong here.

The [skills CLI](https://github.com/vercel-labs/skills#install-a-skill) discovers `skills/<name>/SKILL.md` directly and installs the complete folder, including supporting scripts, assets and package metadata. A separate plugin manifest is not required for this route. Check a new skill with a project-scoped installation in a temporary directory; verify its resources are present, and disable telemetry for installation tests.

The [skills.sh FAQ](https://skills.sh/docs/faq) describes automatic leaderboard discovery through real CLI installs with telemetry enabled. CLI installability is separate from a directory listing or endorsement. Verify that a listing is visible before linking to it.

Claude and Codex also support repository-backed plugin marketplaces. Those are separate packaging routes, and adding a repository marketplace does not submit it to either vendor's public directory. If that distribution route is added, follow the current [Claude publishing guide](https://code.claude.com/docs/en/plugins/publish) or [Codex plugin packaging guide](https://developers.openai.com/plugins/build/plugins), and verify the actual install before documenting it.
