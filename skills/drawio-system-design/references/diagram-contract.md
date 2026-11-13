# Model and commands

Python 3.9+ is sufficient; no pip install or SDK is needed. Paths in commands are local. Start from `examples/model.json`, replace its synthetic evidence and geometry, and never present the fixture as a real deployment.

```sh
python3 <skill-dir>/scripts/diagram.py validate model.json
python3 <skill-dir>/scripts/diagram.py build model.json --output output/architecture.drawio
python3 <skill-dir>/scripts/diagram.py validate-xml output/architecture.drawio
```

Build refuses to overwrite either output file. Choose a new name for an iteration, or intentionally remove only your own previous generated outputs. The helper writes `.drawio` and same-basename `.md`; keep the input model too for reproducibility.

## Contract (version 1)

Root fields: `version: 1`, nonempty `title`, `scope`, `ref`, `environment`, `limitations`, `evidence` array, `pages` array. `ref` identifies the inspected source snapshot, not an invented commit. A synthetic example must say so.

Evidence: unique `id`, `kind` (`code`, `infra`, `runtime`, `documentation`, `user`), `source` (relative repository path or authoritative URL), `locator` (symbol/lines/ref or section/date), `statement` (what it supports, not a broad claim).

Page: `name`, `scope`, `view` (`as-is` or `proposed`), `width`, `height` (300..10000), `groups`, `nodes`, `edges`, `findings`. IDs are unique per page, excluding reserved `0` and `1`. Use stable descriptive IDs.

All groups/nodes/edges: `id`, `label`, `status` (`observed`, `inferred`, `unknown`, `proposed`), `evidence` (list of ledger IDs). Observed items need evidence. Other statuses need `reason`. An as-is page rejects proposed items. On a proposal page retain statuses on unchanged components; only changes are proposed.

Groups: additionally `kind` (`account`, `region`, `vpc`, `subnet`, `ownership`, `module`, `external`), optional `parent` group ID and `x,y,w,h`.

Nodes: additionally `icon`, optional `parent` group ID and `x,y,w,h`. Use 64–80px square service icons; allow at least 44px below for labels and extra room for multiline names. Labels wrap at 180px; reserve 90px either side of icon centers. Generic symbols are deliberately generic, not service logos. Service labels include actual purpose as well as service name.

Coordinates are **relative to the parent**, or page when parent is omitted. Reserve the first 90px of a page for its heading, 38px inside a group for its heading, and the last 140px for the legend. Nest parent groups before their children for convenient editor layering. All boxes must fit their parent. Group meaning is explicit: a module/ownership boundary is not a subnet. The validator rejects common regional managed services placed in a subnet; it does not infer networking from layout.

Edges: additionally `source`, `target` (node IDs), `mechanism` (protocol/trigger/operation), `identity` (actual principal or explicit unknown). `label` is the short visible action. A return edge is not implied; add it when it matters. Optional `points: [{"x": 500, "y": 200}, ...]` are page-coordinate routing waypoints. No bidirectional arrow shorthand: model each direction separately when semantics differ. Configured failing calls remain `observed` attempts, not successful transfers.

Findings: `id`, `severity` (`defect`, `risk`, `question`), `title`, `targets` (existing item IDs), `evidence`, `condition`, `impact`, `verify`, `x,y,w,h` (page coordinates). A `defect` also requires `constraint`, the violated rule and why it applies. A defect highlights the targeted arrow/label red, with its finding ID, and adds a visible explanatory card. Risks/questions are amber. Reserve enough card height for the actual text. The adjacent Markdown report carries full evidence and verification steps.

Optional custom `icons` object: keys are new icon names; values contain `style`, `source` and `verifiedWith`. See [icons-and-rendering.md](icons-and-rendering.md). Defaults cannot be overridden silently.

## What the checks do not prove

The model validator checks the contract, references, finite geometry, containment cycles, endpoints, known icon mappings and selected boundary constraints. XML validation checks IDs/references and parseability. Neither validates evidence truth, every cloud integration, visual overlap, IAM semantics, reachability, all renderer stencils, or runtime behavior. An agent must reason, render and inspect the result. A valid model with fake citations is still a bad diagram.
