#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
if ! command -v python3 >/dev/null 2>&1; then
  echo 'Python 3 is needed. Install it from https://www.python.org/downloads/macos/ and run this again.'
  exit 1
fi
if ! python3 -c 'import sys; raise SystemExit(0 if sys.version_info >= (3,10) else 1)'; then
  echo 'Python 3.10 or newer is needed. Install a current version from python.org and run this again.'
  exit 1
fi
if [[ ! -x .venv/bin/python ]]; then
  python3 -m venv .venv
fi
if ! .venv/bin/python -c 'import mediapipe, cv2' >/dev/null 2>&1; then
  echo 'First run: installing the pinned Python packages. No paid services are used.'
  .venv/bin/python -m pip install -r requirements.txt
fi
exec .venv/bin/python main.py "$@"
