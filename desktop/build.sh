#!/usr/bin/env bash
# =============================================================================
#  Vault — native C++ (Qt6 + libsodium) build script for Linux.
#
#  Builds the app with CMake and packages an installable .deb (Ubuntu / Kubuntu
#  / Debian) via CPack. Also runs the crypto self-test.
#
#  Usage:
#     ./build.sh                 # configure + build + package .deb
#     ./build.sh --install-deps  # install build dependencies first (apt/dnf)
#     ./build.sh --run           # build and launch the app (no packaging)
#     ./build.sh --test          # build & run the crypto self-test
#     ./build.sh --install       # build then `sudo cmake --install` system-wide
#     ./build.sh --clean         # remove the build/ directory first
#
#  Dependencies (installed by --install-deps):
#     Ubuntu/Kubuntu: build-essential cmake qt6-base-dev libsodium-dev
#     Fedora:         gcc-c++ cmake qt6-qtbase-devel libsodium-devel rpm-build
# =============================================================================
set -Eeuo pipefail

if [ -t 1 ]; then B=$'\033[1m'; G=$'\033[32m'; Y=$'\033[33m'; R=$'\033[31m'; C=$'\033[36m'; Z=$'\033[0m'
else B=""; G=""; Y=""; R=""; C=""; Z=""; fi
log(){ printf '%s\n' "${C}${B}▶${Z} ${B}$*${Z}"; }
ok(){ printf '%s\n' "${G}✔${Z} $*"; }
die(){ printf '%s\n' "${R}✗ $*${Z}" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

INSTALL_DEPS=false; DO_RUN=false; DO_TEST=false; DO_INSTALL=false; DO_CLEAN=false
while [ $# -gt 0 ]; do
  case "$1" in
    --install-deps) INSTALL_DEPS=true ;;
    --run) DO_RUN=true ;;
    --test) DO_TEST=true ;;
    --install) DO_INSTALL=true ;;
    --clean) DO_CLEAN=true ;;
    -h|--help) sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "Unknown option: $1" ;;
  esac; shift
done

# ---- dependencies ----------------------------------------------------------
if [ "$INSTALL_DEPS" = true ]; then
  log "Installing build dependencies"
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y build-essential cmake qt6-base-dev libsodium-dev libssl-dev libqt6sql6-sqlite libsecret-tools
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y gcc-c++ cmake qt6-qtbase-devel libsodium-devel openssl-devel rpm-build libsecret
  elif command -v pacman >/dev/null 2>&1; then
    sudo pacman -S --needed --noconfirm base-devel cmake qt6-base libsodium openssl libsecret
  else
    die "Unsupported package manager — install cmake, a C++ compiler, Qt6 base and libsodium manually."
  fi
  ok "Dependencies installed"
fi

# ---- checks ----------------------------------------------------------------
log "Checking toolchain"
command -v cmake >/dev/null 2>&1 || die "cmake not found. Run: ./build.sh --install-deps"
{ command -v g++ >/dev/null 2>&1 || command -v clang++ >/dev/null 2>&1; } || die "No C++ compiler found."
pkg-config --exists libsodium 2>/dev/null || die "libsodium not found. Run: ./build.sh --install-deps"
ok "Toolchain OK — $(cmake --version | head -1)"

# ---- configure + build -----------------------------------------------------
[ "$DO_CLEAN" = true ] && { log "Cleaning build/"; rm -rf build; }
log "Configuring (CMake)"
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
log "Building"
cmake --build build --parallel "$(nproc 2>/dev/null || echo 2)"
ok "Built: build/saleh-vault"

# ---- self-test -------------------------------------------------------------
if [ "$DO_TEST" = true ]; then
  log "Building & running crypto self-test"
  cmake --build build --target vault-selftest
  ./build/vault-selftest
  log "Building & running headless UI smoke test"
  cmake --build build --target vault-smoke
  QT_QPA_PLATFORM=offscreen ./build/vault-smoke
fi

# ---- run / install / package ----------------------------------------------
if [ "$DO_RUN" = true ]; then
  log "Launching Vault"
  exec ./build/saleh-vault
fi

if [ "$DO_INSTALL" = true ]; then
  log "Installing system-wide (sudo)"
  sudo cmake --install build
  ok "Installed. Launch 'Vault' from your apps menu or run: saleh-vault"
  exit 0
fi

# default: package .deb via CPack
log "Packaging .deb (CPack)"
( cd build && cpack -G DEB )
DEB="$(ls -1 build/*.deb 2>/dev/null | head -n1 || true)"
[ -n "$DEB" ] || die "No .deb produced — check the output above."
SUM="$(sha256sum "$DEB" | cut -d' ' -f1)"
echo
ok "${B}Done.${Z}"
printf '   %s (%s)\n   sha256: %s\n\n' "$DEB" "$(du -h "$DEB" | cut -f1)" "$SUM"
echo "Install:  ${B}sudo apt install ./$DEB${Z}"
echo "Then launch “Vault” from your apps menu, or run: saleh-vault"
