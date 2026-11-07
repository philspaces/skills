# Repository contributors

This repository contains independently usable agent skills under `skills/<slug>/`. Read the affected skill's `SKILL.md` and the references relevant to your change before editing it.

Keep each skill self-contained: a copied folder must include the runtime, dependencies, assets, and notices needed for its workflow. Keep shared repository tooling small. Add future skills as sibling folders; do not introduce a framework, registry, or cross-skill dependency without a concrete requirement.

Preserve public examples and reusable instructions. Do not include private project context, personal filesystem paths, credentials, or assets without an appropriate license. Keep font license notices with bundled and generated fonts.

For `animate-ascii-wordmark`, maintain the behavior defined in `references/animation.md`, update documented command and runtime contracts when they change, and preserve `agents/openai.yaml` metadata unless the change requires an update. Verify the actual browser render and exported media for visual changes, including light/dark themes, reduced motion, narrow viewports, and loop closure. Run the relevant tests and validation scripts from `package.json`.

Preserve unrelated work and stage only task-owned files. Do not commit, push, publish, or create a release without current authorization for that action.
