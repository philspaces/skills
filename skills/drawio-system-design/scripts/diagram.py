#!/usr/bin/env python3
"""Validate an evidence model and create editable draw.io XML (Python stdlib only)."""
import argparse
import json
import math
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

AWS = {
    'lambda': ('lambda', '#ED7100'), 'ec2': ('ec2', '#ED7100'),
    'ecs': ('ecs', '#ED7100'), 'fargate': ('fargate', '#ED7100'),
    's3': ('s3', '#7AA116'), 'dynamodb': ('dynamodb', '#C925D1'),
    'rds': ('rds', '#C925D1'), 'api-gateway': ('api_gateway', '#E7157B'),
    'sqs': ('sqs', '#E7157B'), 'sns': ('sns', '#E7157B'),
    'step-functions': ('step_functions', '#E7157B'),
    'cognito': ('cognito', '#DD344C'), 'secrets-manager': ('secrets_manager', '#DD344C'),
    'kms': ('key_management_service', '#DD344C'),
    'cloudwatch': ('cloudwatch', '#E7157B'), 'cloudfront': ('cloudfront', '#8C4FFF'),
}
ICONS = {f'aws:{k}': f'shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.{v[0]};fillColor={v[1]};strokeColor=#ffffff;'
         for k, v in AWS.items()}
ICONS.update({'generic:actor': 'shape=umlActor;fillColor=#ffffff;strokeColor=#334155;',
              'generic:service': 'rounded=1;fillColor=#e2e8f0;strokeColor=#475569;',
              'generic:database': 'shape=cylinder3;fillColor=#e2e8f0;strokeColor=#475569;',
              'generic:external': 'shape=cloud;fillColor=#e2e8f0;strokeColor=#475569;'})
STATES = {'observed', 'inferred', 'unknown', 'proposed'}
COLORS = {'observed': '#334155', 'inferred': '#B45309', 'unknown': '#B45309', 'proposed': '#2563EB'}
REGIONAL = {'aws:s3', 'aws:dynamodb', 'aws:cognito', 'aws:api-gateway', 'aws:sqs', 'aws:sns',
            'aws:step-functions', 'aws:kms', 'aws:secrets-manager', 'aws:cloudwatch', 'aws:cloudfront'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def text(value):
    return isinstance(value, str) and bool(value.strip())


def number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def validate(model):
    require(model.get('version') == 1, 'version must be 1')
    require(text(model.get('title')), 'title is required')
    for field in ['scope', 'ref', 'environment', 'limitations']:
        require(text(model.get(field)), f'{field} is required')
    evidence = model.get('evidence', [])
    require(isinstance(evidence, list), 'evidence must be an array')
    evidence_ids = set()
    for item in evidence:
        require(text(item.get('id')) and item['id'] not in evidence_ids, 'evidence IDs must be unique')
        evidence_ids.add(item['id'])
        for field in ['source', 'locator', 'statement', 'kind']:
            require(text(item.get(field)), f'evidence {item["id"]}: {field} required')
        require(item['kind'] in {'code', 'infra', 'runtime', 'documentation', 'user'}, 'invalid evidence kind')
    icons = dict(ICONS)
    for key, item in model.get('icons', {}).items():
        require(key not in icons, f'cannot override bundled icon {key}')
        require(text(item.get('style')) and text(item.get('source')), f'icon {key} needs style and source')
        require(text(item.get('verifiedWith')), f'icon {key} needs verifiedWith (renderer/version)')
        require('shape=' in item['style'], f'icon {key} needs a verified shape')
        require(not any(s in item['style'].lower() for s in ['image=', 'javascript:', 'http:', 'https:']),
                'custom icons must use local stencils, not remote images or executable URLs')
        icons[key] = item['style']
    pages = model.get('pages')
    require(isinstance(pages, list) and pages, 'at least one page is required')
    for page in pages:
        require(text(page.get('name')) and text(page.get('scope')), 'page name and scope are required')
        require(page.get('view') in {'as-is', 'proposed'}, 'page view must be as-is or proposed')
        require(all(number(page.get(k)) and 300 <= page[k] <= 10000 for k in ['width', 'height']),
                'page dimensions must be finite, 300..10000')
        groups, nodes, edges, findings = [page.get(k, []) for k in ['groups', 'nodes', 'edges', 'findings']]
        require(all(isinstance(x, list) for x in [groups, nodes, edges, findings]), 'page items must be arrays')
        items = groups + nodes + edges
        ids = [i.get('id') for i in items]
        require(all(text(i) and i not in {'0', '1'} for i in ids) and len(ids) == len(set(ids)),
                'item IDs must be unique and not 0 or 1')
        byid = {i['id']: i for i in items}
        groupids = {g['id'] for g in groups}
        nodeids = {n['id'] for n in nodes}
        for item in items:
            ident = item['id']
            require(text(item.get('label')), f'{ident}: label required')
            state = item.get('status')
            require(state in STATES, f'{ident}: invalid status')
            require(page['view'] != 'as-is' or state != 'proposed', f'{ident}: proposal on as-is page')
            refs = item.get('evidence', [])
            require(isinstance(refs, list) and all(r in evidence_ids for r in refs), f'{ident}: unknown evidence reference')
            require(state != 'observed' or bool(refs), f'{ident}: observed items require evidence')
            require(state == 'observed' or text(item.get('reason')), f'{ident}: uncertainty/proposal needs reason')
        for item in groups + nodes:
            ident = item['id']
            parent = item.get('parent')
            require(parent is None or parent in groupids, f'{ident}: parent must be a group')
            visited = {ident}
            while parent:
                require(parent not in visited, f'{ident}: containment cycle')
                visited.add(parent)
                parent = byid[parent].get('parent')
            require(all(number(item.get(k)) for k in ['x', 'y', 'w', 'h']), f'{ident}: finite geometry required')
            require(item['w'] >= 40 and item['h'] >= 40, f'{ident}: minimum size 40')
            parentbox = byid.get(item.get('parent'), {'w': page['width'], 'h': page['height'] - 140})
            require(item['x'] >= 0 and item['y'] >= (38 if item.get('parent') else 90), f'{ident}: overlaps header')
            labelheight = 44 if ident in nodeids else 0
            require(item['x'] + item['w'] <= parentbox['w'] and item['y'] + item['h'] + labelheight <= parentbox['h'],
                    f'{ident}: outside parent or page (reserve space for labels)')
        for group in groups:
            require(group.get('kind') in {'account', 'region', 'vpc', 'subnet', 'ownership', 'module', 'external'},
                    f'{group["id"]}: invalid boundary kind')
        for node in nodes:
            require(node.get('icon') in icons, f'{node["id"]}: unknown icon')
            parent = node.get('parent')
            while parent:
                require(not (byid[parent]['kind'] == 'subnet' and node['icon'] in REGIONAL),
                        f'{node["id"]}: regional/global managed service is not hosted in a subnet; model endpoint separately')
                parent = byid[parent].get('parent')
        for edge in edges:
            require(edge.get('source') in nodeids and edge.get('target') in nodeids, f'{edge["id"]}: dangling endpoint')
            for field in ['mechanism', 'identity']:
                require(text(edge.get(field)), f'{edge["id"]}: {field} required (state unknown explicitly if needed)')
            for p in edge.get('points', []):
                require(set(p) == {'x', 'y'} and all(number(p[k]) for k in p), f'{edge["id"]}: invalid waypoint')
        fids = set()
        for finding in findings:
            fid = finding.get('id')
            require(text(fid) and fid not in fids and fid not in byid, 'finding IDs must be unique')
            fids.add(fid)
            require(finding.get('severity') in {'defect', 'risk', 'question'}, f'{fid}: invalid finding severity')
            for field in ['title', 'condition', 'impact', 'verify']:
                require(text(finding.get(field)), f'{fid}: {field} required')
            require(finding.get('targets') and all(i in byid for i in finding['targets']), f'{fid}: invalid finding target')
            require(finding.get('evidence') and all(r in evidence_ids for r in finding['evidence']), f'{fid}: evidence required')
            if finding['severity'] == 'defect':
                require(text(finding.get('constraint')), f'{fid}: confirmed defect needs violated constraint')
            require(all(number(finding.get(k)) for k in ['x', 'y', 'w', 'h']), f'{fid}: geometry required')
            require(finding['x'] >= 0 and finding['y'] >= 90 and finding['w'] >= 160 and finding['h'] >= 80 and
                    finding['x'] + finding['w'] <= page['width'] and finding['y'] + finding['h'] <= page['height'] - 140,
                    f'{fid}: finding outside page or too small')
    return icons


def cell(root, ident, label, style, parent='1', geometry=None, **attrs):
    obj = ET.SubElement(root, 'object', {'id': ident, 'label': label})
    c = ET.SubElement(obj, 'mxCell', {'parent': parent, 'style': style, **attrs})
    if geometry:
        ET.SubElement(c, 'mxGeometry', {k: str(v) for k, v in geometry.items()} | {'as': 'geometry'})
    return obj, c


def build(model):
    icons = validate(model)
    doc = ET.Element('mxfile', {'host': 'app.diagrams.net', 'agent': 'drawio-system-design', 'version': '1'})
    for index, page in enumerate(model['pages']):
        diagram = ET.SubElement(doc, 'diagram', {'id': f'page-{index + 1}', 'name': page['name']})
        graph = ET.SubElement(diagram, 'mxGraphModel', {'grid': '1', 'gridSize': '10', 'page': '1', 'pageScale': '1',
                    'pageWidth': str(page['width']), 'pageHeight': str(page['height']), 'background': '#ffffff'})
        root = ET.SubElement(graph, 'root')
        ET.SubElement(root, 'mxCell', {'id': '0'})
        ET.SubElement(root, 'mxCell', {'id': '1', 'parent': '0'})
        # Internal IDs cannot collide with user-provided model IDs.
        used = {i['id'] for k in ['groups', 'nodes', 'edges', 'findings'] for i in page.get(k, [])}
        def internal(base):
            while base in used: base += '_'
            used.add(base)
            return base
        cell(root, internal('_title'), f'{model["title"]} | {page["name"]}\n{page["view"]} · {page["scope"]}\n{model["environment"]} · {model["ref"]}',
             'text;html=0;align=left;verticalAlign=middle;fontSize=16;fontStyle=1;whiteSpace=wrap;',
             geometry={'x': 24, 'y': 12, 'width': page['width'] - 48, 'height': 70}, vertex='1')
        defects = {target: f['id'] for f in page.get('findings', []) if f['severity'] == 'defect' for target in f['targets']}
        for kind in ['groups', 'nodes', 'edges']:
            for item in page.get(kind, []):
                status = item['status']
                color = '#B91C1C' if item['id'] in defects else COLORS[status]
                label = item['label']
                if item['id'] in defects: label += f' [{defects[item["id"]]}: broken]'
                if status != 'observed': label += f' [{status}]'
                if kind == 'groups':
                    fill = '#EFF6FF' if item['kind'] in {'vpc', 'subnet'} else '#F8FAFC'
                    style = f'swimlane;html=0;startSize=30;horizontal=1;rounded=0;fillColor={fill};swimlaneFillColor={fill};strokeColor={color};fontColor=#334155;fontSize=13;fontStyle=1;dashed=1;'
                elif kind == 'nodes':
                    style = icons[item['icon']] + f'html=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;fontColor={color};fontSize=13;whiteSpace=wrap;spacingTop=6;labelWidth=180;'
                    if item['id'] in defects: style += 'strokeWidth=3;'
                else:
                    style = f'edgeStyle=orthogonalEdgeStyle;rounded=0;html=0;endArrow=block;endFill=1;strokeColor={color};fontColor={color};fontSize=12;labelBackgroundColor=#ffffff;strokeWidth=2;'
                    if status != 'observed' or item['id'] in defects: style += 'dashed=1;'
                if kind == 'edges':
                    obj, c = cell(root, item['id'], label, style, edge='1', source=item['source'], target=item['target'])
                    geom = ET.SubElement(c, 'mxGeometry', {'relative': '1', 'as': 'geometry'})
                    if item.get('points'):
                        points = ET.SubElement(geom, 'Array', {'as': 'points'})
                        for p in item['points']: ET.SubElement(points, 'mxPoint', {k: str(v) for k, v in p.items()})
                    obj.set('mechanism', item['mechanism']); obj.set('identity', item['identity'])
                else:
                    obj, c = cell(root, item['id'], label, style, parent=item.get('parent') or '1',
                           geometry={'x': item['x'], 'y': item['y'], 'width': item['w'], 'height': item['h']}, vertex='1')
                obj.set('status', status); obj.set('evidence', ', '.join(item.get('evidence', [])))
                if item.get('reason'): obj.set('reason', item['reason'])
        for f in page.get('findings', []):
            color = '#B91C1C' if f['severity'] == 'defect' else '#B45309'
            label = f'{f["id"]} · {f["severity"].upper()}: {f["title"]}\nWhen: {f["condition"]}\nImpact: {f["impact"]}'
            obj, _ = cell(root, f['id'], label, f'rounded=1;html=0;whiteSpace=wrap;align=left;verticalAlign=top;spacing=12;fillColor=#FFF7ED;strokeColor={color};fontColor={color};fontSize=13;',
                         geometry={'x': f['x'], 'y': f['y'], 'width': f['w'], 'height': f['h']}, vertex='1')
            obj.set('evidence', ', '.join(f['evidence'])); obj.set('targets', ', '.join(f['targets']))
        cell(root, internal('_legend'), 'LEGEND  Solid = source-supported (not live proof) · Dashed amber = inferred / unknown\nBlue = proposed · Red + finding ID = confirmed broken path\nLimits: ' + model['limitations'],
             'text;html=0;align=left;verticalAlign=top;whiteSpace=wrap;fontSize=12;fontColor=#475569;',
             geometry={'x': 24, 'y': page['height'] - 125, 'width': page['width'] - 48, 'height': 110}, vertex='1')
    ET.indent(doc)
    return ET.tostring(doc, encoding='unicode', xml_declaration=True)


def report(model):
    lines = [f'# {model["title"]}', '', f'Scope: {model["scope"]}', f'Ref: {model["ref"]}',
             f'Environment: {model["environment"]}', '', f'Limits: {model["limitations"]}', '', '## Evidence', '']
    for e in model['evidence']:
        lines += [f'- **{e["id"]}** ({e["kind"]}) — {e["source"]}, {e["locator"]}: {e["statement"]}']
    for page in model['pages']:
        lines += ['', f'## {page["name"]} ({page["view"]})', page['scope'], '', '### Traceability', '']
        for kind in ['groups', 'nodes', 'edges']:
            for i in page.get(kind, []):
                lines += [f'- **{i["id"]}** {i["label"]} [{i["status"]}] — evidence: {", ".join(i.get("evidence", [])) or "none"}. {i.get("reason", "")}']
                if kind == 'edges': lines += [f'  - {i["source"]} → {i["target"]}; {i["mechanism"]}; identity: {i["identity"]}.']
        lines += ['', '### Findings', '']
        if not page.get('findings'): lines += ['No findings recorded. This is not a correctness or security guarantee.']
        for f in page.get('findings', []):
            lines += [f'- **{f["id"]} [{f["severity"]}] {f["title"]}**', f'  - Targets: {", ".join(f["targets"])}; evidence: {", ".join(f["evidence"])}.',
                      f'  - Condition: {f["condition"]}', f'  - Impact: {f["impact"]}', f'  - Constraint: {f.get("constraint", "Not confirmed")}', f'  - Verify: {f["verify"]}']
    return '\n'.join(line.rstrip() for line in lines) + '\n'


def validate_xml(path):
    data = Path(path).read_text()
    require('<!DOCTYPE' not in data.upper() and '<!ENTITY' not in data.upper(), 'DTD/entities are not accepted')
    doc = ET.fromstring(data)
    require(doc.tag == 'mxfile', 'expected mxfile')
    require(bool(doc.findall('diagram')), 'no diagrams')
    for diagram in doc.findall('diagram'):
        root = diagram.find('mxGraphModel/root')
        require(root is not None, 'expected uncompressed mxGraphModel')
        ids = [x.get('id') for x in root if x.get('id')]
        require(len(ids) == len(set(ids)), 'duplicate XML IDs')
        for c in root.iter('mxCell'):
            for key in ['parent', 'source', 'target']:
                require(c.get(key) is None or c.get(key) in ids, f'XML dangling {key}')
    return len(doc.findall('diagram'))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['validate', 'build', 'validate-xml'])
    parser.add_argument('input', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    try:
        if args.command == 'validate-xml':
            print(f'Valid XML: {validate_xml(args.input)} page(s)'); return
        model = json.loads(args.input.read_text())
        validate(model)
        if args.command == 'validate':
            print('Model valid (structural checks only; technical review still required)'); return
        require(args.output is not None and args.output.suffix == '.drawio', '--output must end in .drawio')
        out = args.output
        require(not out.exists() and not out.with_suffix('.md').exists(), 'output exists; choose a new path or remove intentionally')
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(build(model))
        out.with_suffix('.md').write_text(report(model))
        validate_xml(out)
        print(f'Created {out} and {out.with_suffix(".md")}')
    except (ValueError, KeyError, TypeError, OSError, ET.ParseError) as error:
        parser.exit(1, f'Error: {error}\n')


if __name__ == '__main__':
    main()
