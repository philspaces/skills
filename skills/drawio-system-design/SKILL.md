---
name: drawio-system-design
description: Create editable draw.io system-design diagrams from code, infrastructure and runtime evidence, using service icons and explicit network boundaries. Review the diagram against implementation to expose broken or infeasible flows, distinguish confirmed defects from hypotheses, and optionally show a separate proposed repair.
license: MIT; service marks belong to their respective owners
---

# Draw.io system design

Build an architecture explanation that can be checked against its sources, not a plausible-looking cloud illustration. Deliver an editable `.drawio`, a rendered preview, and a short evidence/findings report. The diagram is an analysis aid, not proof that a system works or a complete security audit.

## Establish the view

Identify the repository/ref, environment, question, and relevant request/event path. For an existing system, default to **as implemented**. Do not blend dev, production, historical diagrams, or proposed changes. If only a concept is supplied, label the page **Proposed** and record its assumptions. Use the user's reference for visual hierarchy, not as evidence that its topology is correct.

Read repository instructions first. Inspect entry points and callers, infrastructure definitions, IAM/resource policies, routes and network controls, event subscriptions, storage access, retries and error paths. Follow indirection through shared modules and environment overrides. Do not draw every imported SDK or installed dependency as a deployed service. Explain gaps if deployment state or generated configuration is inaccessible.

## Trace before drawing

Read [architecture-review.md](references/architecture-review.md). Build a small evidence ledger: relative path + symbol/line range + commit/ref, or authoritative documentation URL + relevant statement + date checked. Separate `observed` (supported by the inspected source), `inferred`, `unknown`, and `proposed`. Source code proves implemented intent, not live deployment; make that limit visible.

For each arrow, establish **who initiates, what operation, protocol/trigger, identity, route and receiver**. Trace a complete happy path and the failure path relevant to the question. Check against current provider documentation when a service capability or limit is uncertain. A missing file in a partial search is not a proven missing permission or resource.

Record defects only when an evidenced path contradicts an evidenced requirement or service contract. Show the broken link or missing prerequisite with a numbered red finding, the condition that triggers it, and its impact. Use amber for unresolved risks and missing context. Do not make a broken deployed path look healthy by quietly adding the required gateway, permission or consumer. Put possible repairs on a separate **Proposed repair** page.

## Create the artifact

Read [diagram-contract.md](references/diagram-contract.md) for the model and commands. The included Python 3 helper has no third-party dependencies:

```sh
python3 <skill-dir>/scripts/diagram.py validate model.json
python3 <skill-dir>/scripts/diagram.py build model.json --output architecture.drawio
```

It creates uncompressed native draw.io XML and an adjacent evidence/findings Markdown report. Its checks catch structural errors and a few topology mistakes, not arbitrary architectural defects. The agent must perform the technical review above.

Use bundled draw.io service stencils and readable labels, not icon-shaped text boxes. Included AWS icons are a starter set, not a restriction to AWS. For another provider/service, inspect the actual target draw.io library and register a verified stencil using the model's `icons` map. Follow [icons-and-rendering.md](references/icons-and-rendering.md); never invent a stencil ID or substitute a different service's logo. An explicitly labeled generic symbol is better than a misleading icon.

Arrange actor → ingress → compute → storage/event destination; group actual account/region/VPC/subnet boundaries separately from ownership or modules. Use orthogonal connectors, short operation labels, and waypoints to avoid crossing nodes. Split overviews from detailed flows rather than making tiny labels. Each page carries its evidence status legend and scope. Leave space for numbered findings.

## Verify and deliver

1. Run model validation, build, then validate the generated XML. Correct dangling edges, cycles in containment, unknown icons, missing evidence and out-of-bounds geometry.
2. Render with installed draw.io (see rendering reference), open the actual PNG/SVG and inspect icons, labels, boundary membership, direction, overlapping edges, and finding markers. XML validity alone is not visual validation. If rendering is unavailable, disclose it and deliver the editable artifact as unrendered.
3. Walk every displayed path back to code/config and its provider contract. Confirm no proposed repair or uncertainty is presented as an observed working connection. Verify that each confirmed finding contains evidence, a trigger, impact, and a falsifiable verification step.
4. Deliver files plus a concise explanation of scope/ref, confirmed findings, unresolved checks and what was not verified. Do not promise exhaustive defect detection. Do not modify infrastructure, install into a user's agent, publish, or upload private architecture to a third-party renderer unless the task authorizes it. Prefer local desktop export for private code.

For a runnable diagram model of an intentionally flawed **synthetic** system, see [examples/model.json](examples/model.json) and its [fixture](examples/fixture/main.tf). This is a test example, not a reference architecture to copy blindly.

See the locally rendered synthetic [preview](examples/rendered/architecture.png), editable [draw.io example](examples/rendered/architecture.drawio), and [evidence report](examples/rendered/architecture.md). They demonstrate an explicit IAM deny on a document-read path, not a live infrastructure audit.
