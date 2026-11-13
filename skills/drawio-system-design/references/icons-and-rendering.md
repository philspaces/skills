# Service icons and rendering

Use native draw.io stencils where available. The generated diagram references stencils shipped with draw.io; this skill does not bundle raw vendor stencil libraries. The synthetic preview uses their rendered icons; service marks belong to their respective owners. Labels remain editable. Do not replace a service with a visually similar but technically different service icon.

## Included mappings

AWS: `aws:lambda`, `aws:ec2`, `aws:ecs`, `aws:fargate`, `aws:s3`, `aws:dynamodb`, `aws:rds`, `aws:api-gateway`, `aws:sqs`, `aws:sns`, `aws:step-functions`, `aws:cognito`, `aws:secrets-manager`, `aws:kms`, `aws:cloudwatch`, `aws:cloudfront`.

Generic, explicitly non-vendor: `generic:actor`, `generic:service`, `generic:database`, `generic:external`. Use these for custom code, actors or unresolved components, not as a shortcut when a service stencil exists.

AWS resource mappings use `mxgraph.aws4.resourceIcon` plus a verified `resIcon`, as in draw.io's AWS palette. They were inspected in draw.io Desktop 31.1.8. Verify rendering on the target version rather than assuming future compatibility.

## More services and providers

Inspect the actual installed draw.io libraries, the editor's shape palette, or the official [draw.io source](https://github.com/jgraph/drawio/tree/dev/src/main/webapp). Service names and stencil identifiers are not interchangeable. Confirm the ID and style from the palette definitions or an exported sample, then add a model mapping:

```json
{
  "icons": {
    "aws:internet-gateway": {
      "style": "shape=mxgraph.aws4.internet_gateway;fillColor=#8C4FFF;strokeColor=#ffffff;",
      "source": "draw.io AWS4 palette, Internet Gateway",
      "verifiedWith": "draw.io Desktop 31.1.8; rendered and visually checked"
    }
  }
}
```

The metadata must describe a check actually performed. Azure, GCP, Kubernetes and other ecosystems can use the same extension mechanism after checking their own built-in libraries. If a stencil is missing, do not invent it. Use a labeled generic shape and disclose the fallback, or obtain an authorized, licensed local icon. External icon fetching is deliberately not implemented by the generator; do not hotlink private or expiring URLs.

## Local export

Prefer an installed draw.io Desktop binary for private architecture. Inspect its CLI help/version for supported options. Typical usage:

```sh
drawio --export --format png --scale 1.5 --border 20 --output architecture.png architecture.drawio
```

On macOS the installed binary may be `/Applications/draw.io.app/Contents/MacOS/draw.io`; quote the path. Linux may need a display, e.g. an already available `xvfb-run`. Do not change security settings or install software just to make an export work without applicable authorization. For multiple pages, select/export each page using the installed version's page-index option (often `--page-index 0`); do not claim all pages reviewed from one preview. SVG/PDF export is also available when supported.

Do not upload a private codebase or architecture model to app.diagrams.net or a hosted conversion service without authorization. Opening an editor with local files and cloud/network features can transmit content; use an offline/local workflow when required.

After export, view the actual image. Check recognizable service icons, not missing-stencil rectangles; all text readable at normal scale; arrows terminate on the correct service; no arrows through unrelated icons; true boundary membership; no cropped content; red finding on the exact defective link. Adjust geometry and rerender. A helper exit code or XML parser pass is not a visual check.

If the CLI fails, the installed draw.io renderer may also be run locally in a browser with network access blocked; use the native renderer, not a separate imitation. If neither local rendering route can run, deliver editable XML and explicitly report the preview/visual verification as blocked. Do not manufacture a preview that differs from the draw.io output.

## Primary references

- [draw.io XML editing](https://www.drawio.com/doc/faq/diagram-source-edit)
- [draw.io Desktop](https://github.com/jgraph/drawio-desktop)
- [draw.io built-in libraries and source](https://github.com/jgraph/drawio/tree/dev/src/main/webapp)
- [AWS architecture icons and usage](https://aws.amazon.com/architecture/icons/)
