# Architecture reasoning and defect review

## Evidence levels

- **Observed:** directly supported by the inspected implementation, configuration, log or inventory. State which of these; an IaC definition does not prove successful deployment. Record environment and ref.
- **Inferred:** consistent with the sources but some link is not verified. Give the reason and missing check.
- **Unknown:** no adequate evidence. Draw only when needed to explain the question; use an explicit question mark and amber/dashed treatment.
- **Proposed:** a new design or correction. Keep it off the observed page or use a clearly separate proposal page.

Every component, boundary and connection should point to evidence or an uncertainty note. Reuse stable evidence IDs so an arrow can be audited. Never include keys, tokens, real customer records, or unnecessary account identifiers in diagram labels or evidence excerpts.

## Review each meaningful connection

| Dimension | What must agree |
| --- | --- |
| Invocation | Caller vs receiver, push vs pull, request/response vs asynchronous event, API/resource actually supported by the service |
| Network | Account/region, endpoint type, DNS, route tables, ingress/egress, subnet association, security groups, NACLs, VPC endpoints/NAT and return path |
| Identity | Real principal, role assumption/trust, identity policy, resource policy, key policy and tenant/resource scoping; do not infer permission from an SDK call |
| Data | Format, object/key ownership, size and serialization, lifecycle, residency, encryption and read/write direction |
| Failure | Timeouts, retries and backoff, duplicate delivery, idempotency, acknowledgement order, partial commits, dead-letter/redrive, recovery and observability |
| State | Transaction boundaries, stale cache/index windows, ordering, concurrent writers, authorization after identity/tenant changes |
| Deployment | Conditional resources, env overrides, provider/version constraints, feature flags, defaults, generated outputs and differences between code, plan and live state |

Ask what must be true for the **specific operation** to succeed. Avoid checklists of hypothetical flaws unconnected to a depicted path. If an API cannot directly trigger a service, draw the actual intermediary if evidenced; otherwise show the unresolved/invalid link, not an invented bridge.

AWS examples worth checking, not blanket rules:
- S3, DynamoDB and Cognito are regional managed services, not resources physically hosted in a private subnet. A VPC endpoint is a separate resource with different semantics. EFS mount targets are subnet resources; the EFS file system itself is regional.
- A Lambda VPC attachment uses ENIs; it does not move the Lambda service control plane into that subnet. A public subnet alone does not give a VPC-attached Lambda internet access.
- An internet-facing ALB is not an internet gateway. A NAT gateway is outbound connectivity, not an inbound application entry point. Route and placement requirements depend on the exact gateway type.
- IAM permission does not establish network reachability, and reachability does not establish authorization. Presigned URLs have separate issuance and use paths.
- SQS/Lambda is usually an event-source mapping poller, not the queue issuing an ordinary HTTP request. Label the trigger mechanism accurately.

Use current primary provider documentation to check applicability rather than treating these examples as a complete rules engine.

## Finding standard

A confirmed finding needs:
1. Specific observed component/edge IDs.
2. Evidence of actual configuration/behavior plus the violated constraint or contract.
3. A concrete trigger/precondition and consequence.
4. A way to verify or falsify it (test, scoped inspection or log observation).

Use **risk** when preconditions or completeness remain unknown, **question** for missing context. A red edge can depict a configured attempt that fails; it must never imply a successful data path. A missing prerequisite can be a finding callout without inventing a deployed node. Put a minimal feasible repair on its own proposed page, referencing the finding. Keep unaffected flow visible so the failure has context.

Do not assert “no defects” because validation passed. Report “no confirmed defect in the inspected path” with coverage and limits. This skill produces a reasoned review, not a formal proof, penetration test, or guarantee of runtime behavior.
