# Document worker: trace the failed read

Scope: Intentionally flawed synthetic review fixture; no private project data
Ref: synthetic fixture v1
Environment: Example only, not deployed

Limits: Static fixture review only. Caller, actual deployment and log delivery unverified; no AWS calls were made.

## Evidence

- **E1** (infra) — fixture/main.tf, lines 2-4, 22-29; synthetic fixture v1: The example defines S3 storage and a Lambda function bound to the worker role.
- **E2** (code) — fixture/handler.py, main, lines 5-7; synthetic fixture v1: The handler logs a message then attempts S3 GetObject using execution-role credentials.
- **E3** (infra) — fixture/main.tf, worker policy, lines 12-20; synthetic fixture v1: The worker role explicitly denies s3:GetObject on objects in the target bucket and allows log writes.
- **E4** (documentation) — https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html, Policy evaluation logic; verify applicability against current docs: An applicable explicit deny overrides an allow. The agent must verify this contract when reviewing a real system.

## Current path and defect (as-is)
Synthetic code/infra snapshot, not a live deployment

### Traceability

- **system** Example application · logical boundary, not a VPC [observed] — evidence: E1, E2, E3.
- **caller** Caller (not supplied) [unknown] — evidence: none. The fixture omits the invocation path.
- **worker** AWS Lambda
Document worker [observed] — evidence: E1.
- **storage** Amazon S3
Documents [observed] — evidence: E1.
- **logs** Amazon CloudWatch
Log destination [inferred] — evidence: E2, E3. Code logs and role allows logs; log group deployment is not inspected.
- **invoke** Invocation not supplied [unknown] — evidence: none. No caller is included in this bounded fixture.
  - caller → worker; Unknown invocation path; identity: Unknown caller.
- **read** GetObject attempt → AccessDenied [observed] — evidence: E2, E3, E4.
  - worker → storage; AWS SDK / HTTPS S3 GetObject; identity: Lambda worker execution role.
- **write-log** Log delivery [inferred] — evidence: E2, E3. Log intent is supported; delivery was not observed.
  - worker → logs; Lambda platform to CloudWatch Logs; identity: Lambda execution role.

### Findings

- **F1 [defect] Explicit deny blocks document reads**
  - Targets: read; evidence: E2, E3, E4.
  - Condition: Worker reads an object in the configured bucket
  - Impact: GetObject is denied; the handler cannot return the document.
  - Constraint: Applicable explicit IAM Deny overrides Allow for this principal/action/resource.
  - Verify: Inspect deployed role policies and bucket ARN; in an authorized test invoke with an existing key and inspect AccessDenied. No live test was run.
