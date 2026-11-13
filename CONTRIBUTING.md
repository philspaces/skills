# Contributing

Each `skills/<slug>/` folder is an independent installable skill. A copied folder must include everything needed for its documented workflow, apart from explicitly declared external tools. Repository tooling is for maintainers, never a runtime dependency of a skill.

## Repository layout

```text
skills/<slug>/
  SKILL.md               Entry point and agent instructions
  LICENSE                License for code and documentation
  agents/openai.yaml     Display metadata and default prompt
  references/            Optional, progressively loaded guidance
  scripts/               Runtime commands the agent can execute
  assets/                Runtime templates, fonts and bundled resources
  examples/              Optional self-contained fixtures and reviewed outputs
  tests/                 Unit tests, installed.mjs, optional browser.mjs
  package.json           Only when that skill needs Node dependencies
scripts/                 Collection checks and test orchestration
scripts/tests/           Tests of repository-only tooling
examples/                Public catalog/showcase media; preserve existing URLs
.github/workflows/       Automated fast checks, install smoke tests, browser tests
```

Do not add empty folders for symmetry. Keep service icons/templates with the skill that needs them; avoid shared runtime assets, nested skill categories, a registry or plugin framework until there is a concrete need. Language-specific skills need not have an npm package. The root npm workspace installs dependencies for skills that do.

Root [examples](examples/README.md) are public showcase assets. Skill-local examples are copied with installation and must remain useful outside this repository. Do not move existing public media merely to normalize paths.

## Add or change a skill

1. Add a sibling `skills/<lowercase-hyphenated-slug>/`. Match its `name` in `SKILL.md` frontmatter; provide a concrete trigger/capability in `description` and declare its license.
2. Keep the entry point short. Link optional detail from `references/`; put executable work in `scripts/`. Document runtime dependencies and setup in the skill, not the root README.
3. Include its license and required third-party notices. Keep secrets, machine-specific paths, private project context and unlicensed assets out of examples.
4. Add `agents/openai.yaml` metadata and a README catalog entry. Use a local skill link until a public directory listing is verified.
5. Put Node unit tests in `tests/*.test.mjs` (nested tests are supported). Add `tests/installed.mjs`, a dependency-light smoke test of the installed workflow which runs from any working directory and cleans up its temporary output. Add `tests/browser.mjs` only when browser regression checks are appropriate.
6. Run the checks below and inspect relevant rendered output. No root test-script changes are required for another skill using these conventions.

Keep generated experiments out of version control. Commit only deliberate examples and files needed by the change. Preserve unrelated work; `.idea/`, dependency folders, Python caches and scratch outputs are ignored, not deleted. Explain behavior changes, validation and remaining limitations in the pull request.

## Validation

Use Node.js 22+ and Python 3.9+. Install repository dependencies with `npm ci`.

| Command | Purpose |
| --- | --- |
| `npm run check` | Skill frontmatter, agent metadata, license and install-test presence, catalog entries, JavaScript/Python syntax, JSON and local Markdown links |
| `npm test` | All skill unit tests and repository tooling tests |
| `npm run test:install` | Official skills CLI discovery, independent project-scoped copying and each installed skill's smoke test |
| `npm run test:browser` | Every skill's optional browser test |

Installation checks use the official `skills@1.7.0` CLI via npx, with an isolated temporary home/project and telemetry disabled. For an offline run, set `SKILLS_CLI` to the absolute path of an already installed official `skills/bin/cli.mjs`; the script logs its version. All files are compared byte-for-byte, excluding dependencies/caches, and each copied `tests/installed.mjs` is run. This verifies local packaging, not public publication or an actual agent session.

For browser checks, first run `npx playwright install chromium` and ensure `ffmpeg` is on PATH. Browser tests are intentionally separate from fast checks. CI provisions Python 3.9 for the minimum-version check and runs browser/export checks in a separate job. Native draw.io rendering remains a manual visual check, not a claimed CI capability.

### Skill-specific review

- **Wordmark:** preserve [animation invariants](skills/animate-ascii-wordmark/references/animation.md), command contracts and generated font notices. Inspect browser rendering, exported light/dark media, reduced motion, narrow viewports and loop closure. The installation smoke test generates an offline HTML bundle; browser tests cover playback and GIF export.
- **Draw.io:** run the [synthetic model](skills/drawio-system-design/examples/model.json), render with local draw.io and inspect icons, direction, evidence, boundaries and defect annotations. Unit tests guard native XML/report drift; update and visually recheck the PNG when changing the example or renderer. Structural validation is not architectural proof. No live AWS calls belong in these tests.

## Installation and discovery

The [official skills CLI](https://github.com/vercel-labs/skills#install-a-skill) discovers `skills/<name>/SKILL.md` and installs the complete folder. A plugin manifest is not required. The public form is:

```sh
npx skills add philspaces/skills --skill <slug>
```

It works only after the skill is published to the repository. A successful local smoke test does not publish anything. The [skills.sh FAQ](https://skills.sh/docs/faq) describes automatic leaderboard discovery through user CLI-install telemetry; verify a listing before linking to it, and do not manufacture install counts with test telemetry.

Claude/Codex plugin marketplaces are separate distribution routes, not prerequisites for skills.sh. Adding a marketplace also does not submit a repository to a vendor's public directory. Follow the current vendor packaging guide and test that installation separately if it is introduced later.
