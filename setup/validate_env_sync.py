#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Validate n8n environment variables for CI.
- Compares config/n8n-variables.yaml against docker-compose.yml
- Does NOT require server access (no paramiko)
- Flags:
  --strict  -> exit 1 on any mismatch/missing
  --report  -> print detailed table
"""

import sys
import os
import re
import argparse
from typing import Dict, Tuple

try:
    import yaml
except Exception as e:
    print(f"yaml module is required: {e}")
    sys.exit(1)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
YAML_PATH = os.path.join(ROOT, 'config', 'n8n-variables.yaml')
COMPOSE_PATH = os.path.join(ROOT, 'docker-compose.yml')


def load_yaml_vars() -> Dict[str, str]:
    with open(YAML_PATH, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f) or {}
    out: Dict[str, str] = {}
    out.update(data.get('system_variables', {}) or {})
    out.update(data.get('user_variables', {}) or {})
    # Normalize to strings
    return {k: '' if v is None else str(v) for k, v in out.items()}


def _normalize_value(val: str) -> str:
    # remove comments at EOL
    val = val.split('#', 1)[0].strip()
    # strip quotes
    if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
        val = val[1:-1]
    # convert ${VAR:-default} -> default
    def _subst(m: re.Match) -> str:
        return m.group(2)
    val = re.sub(r"\$\{([^:}]+):-([^}]*)\}", _subst, val)
    return val


def load_compose_vars() -> Dict[str, str]:
    with open(COMPOSE_PATH, 'r', encoding='utf-8') as f:
        content = f.read()
    # match lines like: - NAME=value (in environment: list)
    pairs = re.findall(r"^\s*-\s*([A-Z0-9_]+)=(.*)$", content, re.MULTILINE)
    out: Dict[str, str] = {}
    for name, raw in pairs:
        out[name] = _normalize_value(raw)
    return out


def compare(config: Dict[str, str], compose: Dict[str, str]) -> Tuple[Dict[str, Tuple[str, str]], Dict[str, str]]:
    """Return (mismatches, missing) where:
    mismatches: name -> (yaml_value, compose_value)
    missing: name -> yaml_value (when not present in compose)
    """
    mismatches: Dict[str, Tuple[str, str]] = {}
    missing: Dict[str, str] = {}
    for name, expected in config.items():
        if name not in compose:
            missing[name] = expected
        else:
            actual = compose[name]
            if expected != actual and actual != '':
                mismatches[name] = (expected, actual)
    return mismatches, missing


def main():
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument('--strict', action='store_true')
    parser.add_argument('--report', action='store_true')
    # ignore unknown flags to preserve backward compatibility
    args, _ = parser.parse_known_args()

    cfg = load_yaml_vars()
    cmpv = load_compose_vars()
    mismatches, missing = compare(cfg, cmpv)

    ok = not mismatches and not missing

    if args.report or True:
        print("=== Validate Environment Variables ===")
        print(f"YAML:    {os.path.relpath(YAML_PATH, ROOT)}")
        print(f"Compose: {os.path.relpath(COMPOSE_PATH, ROOT)}\n")
        if ok:
            print("OK: All variables are in sync.")
        else:
            if missing:
                print("ERROR: Missing in docker-compose.yml:")
                for k, v in sorted(missing.items()):
                    print(f"  - {k} = {v}")
            if mismatches:
                print("\nWARN: Mismatched values:")
                for k, (yval, cval) in sorted(mismatches.items()):
                    print(f"  - {k}: YAML='{yval}'  vs  Compose='{cval}'")

    if args.strict and not ok:
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())

