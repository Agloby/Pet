#!/usr/bin/env bash
set -euo pipefail

: "${CONNECTIQ_HOME:?Set CONNECTIQ_HOME to the selected Connect IQ SDK directory.}"
: "${GARMIN_DEVELOPER_KEY:?Set GARMIN_DEVELOPER_KEY to your private developer key path.}"

GARMIN_DEVICE="${GARMIN_DEVICE:-fenix7}"
APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "${APP_ROOT}/build"
"${CONNECTIQ_HOME}/bin/monkeyc" \
  -d "${GARMIN_DEVICE}" \
  -f "${APP_ROOT}/monkey.jungle" \
  -o "${APP_ROOT}/build/Kern.prg" \
  -y "${GARMIN_DEVELOPER_KEY}"
