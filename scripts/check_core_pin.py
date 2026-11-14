"""Verify the reviewed independent Arkhiv engine pin and the core wrapper."""
import json
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
receipt = json.loads((root / 'deploy/core-release.json').read_text())
if (receipt['artifact_kind'] != 'core' or receipt['contract_version'] != 1
        or receipt['configuration_version'] != 1 or '1' not in receipt['api_versions']
        or receipt['modules'].get('catalog') != '1'
        or receipt['modules'].get('print') != '1'
        or receipt['schema_strategy'] != 'checksum-locked-additive-migrations'
        or receipt['engine_repository'] != 'git.subcult.tv/subculture-collective/archive-core'
        or not re.fullmatch(r'[0-9a-f]{40}', receipt['source_revision'])
        or not re.fullmatch(re.escape(receipt['engine_repository']) + r'@sha256:[0-9a-f]{64}', receipt['engine_digest'])
        or not receipt['migrations']
        or any(not re.fullmatch(r'[0-9a-f]{64}', digest) for digest in receipt['migrations'].values())):
    raise SystemExit('Incompatible or incomplete independent core receipt')
if (root / 'deploy/archive-core.env').read_text() != 'ARCHIVE_ENGINE_IMAGE=' + receipt['engine_digest'] + '\n':
    raise SystemExit('Core pin differs from the reviewed release receipt')
# The deployable core wrapper must add labels only, on top of the image CI
# passes in from deploy/archive-core.env. CI also compares the built layers.
dockerfile = re.sub(r'\\\n', ' ', (root / 'deploy/core.Dockerfile').read_text())
steps = [line.split(None, 1) for line in dockerfile.splitlines() if line.strip() and not line.lstrip().startswith('#')]
if not {s[0].upper() for s in steps} <= {'ARG', 'FROM', 'LABEL'}:
    raise SystemExit('core.Dockerfile may only use ARG, FROM and LABEL')
if [s[1].strip() for s in steps if s[0].upper() == 'FROM'] != ['${CORE_IMAGE}']:
    raise SystemExit('core.Dockerfile must build FROM ${CORE_IMAGE}')
if steps[0] != ['ARG', 'CORE_IMAGE']:
    raise SystemExit('CORE_IMAGE must be declared first, without a default')
print('Independent Arkhiv engine pin verified:', receipt['version'], receipt['source_revision'])
