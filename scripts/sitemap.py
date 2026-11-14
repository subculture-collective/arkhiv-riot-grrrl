"""Write web/public/sitemap.xml from the public access manifest.

The sitemap lists the home and series pages and every publicly approved document.
Run with --check to fail when the committed sitemap is out of date.
"""
import json
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'collections/riot-grrrl-public-review.json').read_text())
target = root / 'web/public/sitemap.xml'
base = manifest['public_url'].rstrip('/')
assert re.fullmatch(r'https://[a-z0-9.-]+', base), base
ids = sorted(d['id'] for d in manifest['documents'] if d.get('public_approved'))
for i in ids:
    assert re.fullmatch(r'[0-9a-f]{64}', i), i
urls = [base + '/', base + '/series'] + [f'{base}/documents/{i}' for i in ids]
xml = (
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + ''.join(f'  <url><loc>{u}</loc></url>\n' for u in urls)
    + '</urlset>\n'
)
if '--check' in sys.argv[1:]:
    if target.read_text() != xml:
        sys.exit('web/public/sitemap.xml is out of date; run python3 scripts/sitemap.py')
    print('Sitemap lists the home and series pages and', len(ids), 'public documents')
else:
    target.write_text(xml)
    print('Wrote', target.relative_to(root), 'with', len(urls), 'URLs')
