#!/usr/bin/env bash
# =============================================================================
#  Vault — Linux build script
#
#  Builds the native Vault desktop app into an installable .deb (Ubuntu /
#  Kubuntu / Debian) and a portable .AppImage, prints SHA-256 checksums, and can
#  optionally publish the artifacts to GitHub Releases.
#
#  Usage:
#     ./build.sh                 # build BOTH .deb and .AppImage (default)
#     ./build.sh --deb           # only the .deb
#     ./build.sh --appimage      # only the AppImage
#     ./build.sh --clean         # wipe dist/ and node_modules first
#     ./build.sh --install-deps  # try to install missing system libs (apt/dnf)
#     ./build.sh --release v1.1.0 # build, then upload to a GitHub Release (needs gh)
#
#  Requirements: Node.js 18+ and npm. Internet on first run (Electron download).
# =============================================================================

set -Eeuo pipefail

# ---- pretty logging --------------------------------------------------------
if [ -t 1 ]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GRN=$'\033[32m'
  YLW=$'\033[33m'; CYN=$'\033[36m'; RST=$'\033[0m'
else
  BOLD=""; DIM=""; RED=""; GRN=""; YLW=""; CYN=""; RST=""
fi
log()  { printf '%s\n' "${CYN}${BOLD}▶ ${RST}${BOLD}$*${RST}"; }
ok()   { printf '%s\n' "${GRN}✔ ${RST}$*"; }
warn() { printf '%s\n' "${YLW}⚠ ${RST}$*"; }
die()  { printf '%s\n' "${RED}✗ $*${RST}" >&2; exit 1; }

# ---- go to the desktop/ folder (this script lives there) -------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ---- parse arguments -------------------------------------------------------
BUILD_DEB=false
BUILD_APPIMAGE=false
DO_CLEAN=false
INSTALL_DEPS=false
RELEASE_TAG=""
REPO="im-saleh/Saleh.im"   # change if your GitHub repo differs

while [ $# -gt 0 ]; do
  case "$1" in
    --deb)          BUILD_DEB=true ;;
    --appimage)     BUILD_APPIMAGE=true ;;
    --all)          BUILD_DEB=true; BUILD_APPIMAGE=true ;;
    --clean)        DO_CLEAN=true ;;
    --install-deps) INSTALL_DEPS=true ;;
    --release)      shift; RELEASE_TAG="${1:-}"; [ -n "$RELEASE_TAG" ] || die "--release needs a tag, e.g. --release v1.1.0" ;;
    --repo)         shift; REPO="${1:-}" ;;
    -h|--help)
      sed -n '2,20p' "$0" | sed 's/^#\{0,1\} \{0,1\}//'
      exit 0 ;;
    *) die "Unknown option: $1 (use --help)" ;;
  esac
  shift
done
# default: build both
if [ "$BUILD_DEB" = false ] && [ "$BUILD_APPIMAGE" = false ]; then
  BUILD_DEB=true; BUILD_APPIMAGE=true
fi

# ---- prerequisites ---------------------------------------------------------
log "Checking prerequisites"
command -v node >/dev/null 2>&1 || die "Node.js not found. Install Node 18+ (e.g. 'sudo apt install nodejs npm' or use nvm)."
command -v npm  >/dev/null 2>&1 || die "npm not found. Install npm."

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || die "Node $(node -v) is too old — need 18+."
ok "Node $(node -v), npm $(npm -v)"

# fpm (used to build the .deb) bundles a Ruby that needs libcrypt.so.1.
# It's present on most systems; if not, offer to install it.
if [ "$BUILD_DEB" = true ]; then
  if command -v ldconfig >/dev/null 2>&1 && ! ldconfig -p 2>/dev/null | grep -q 'libcrypt\.so\.1'; then
    warn "libcrypt.so.1 is missing (needed by the .deb packager)."
    if [ "$INSTALL_DEPS" = true ]; then
      if   command -v apt-get >/dev/null 2>&1; then sudo apt-get update && sudo apt-get install -y libcrypt1 || sudo apt-get install -y libxcrypt1 || true
      elif command -v dnf     >/dev/null 2>&1; then sudo dnf install -y libxcrypt-compat || true
      elif command -v pacman  >/dev/null 2>&1; then sudo pacman -S --noconfirm libxcrypt || true
      fi
    else
      warn "Re-run with ${BOLD}--install-deps${RST}, or install it manually:"
      warn "  Ubuntu/Debian:  sudo apt install libcrypt1"
      warn "  Fedora/RHEL:    sudo dnf install libxcrypt-compat"
    fi
  fi
fi

# ---- clean (optional) ------------------------------------------------------
if [ "$DO_CLEAN" = true ]; then
  log "Cleaning dist/ and node_modules/"
  rm -rf dist node_modules
fi

# ---- install deps ----------------------------------------------------------
log "Installing npm dependencies"
if [ -f package-lock.json ]; then
  npm ci || npm install
else
  npm install
fi
ok "Dependencies ready"

# ---- build -----------------------------------------------------------------
# Always clear previous artifacts (but keep node_modules) so outputs stay clean.
rm -rf dist/linux-unpacked dist/*.deb dist/*.AppImage dist/*.blockmap dist/*.rpm 2>/dev/null || true

TARGETS=()
[ "$BUILD_DEB" = true ]      && TARGETS+=("deb")
[ "$BUILD_APPIMAGE" = true ] && TARGETS+=("AppImage")
log "Building for Linux: ${TARGETS[*]}"
npx --no-install electron-builder --linux "${TARGETS[@]}"
ok "electron-builder finished"

# ---- results + checksums ---------------------------------------------------
log "Artifacts"
shopt -s nullglob
ARTS=(dist/*.deb dist/*.AppImage)
[ ${#ARTS[@]} -gt 0 ] || die "No artifacts were produced — check the build output above."

: > dist/SHA256SUMS.txt
for f in "${ARTS[@]}"; do
  size="$(du -h "$f" | cut -f1)"
  sum="$(sha256sum "$f" | cut -d' ' -f1)"
  printf '%s  %s\n' "$sum" "$(basename "$f")" >> dist/SHA256SUMS.txt
  printf '   %s%s%s  (%s)\n     %ssha256:%s %s\n' "$BOLD" "$(basename "$f")" "$RST" "$size" "$DIM" "$RST" "$sum"
done
ok "Checksums written to dist/SHA256SUMS.txt"

# ---- optional: publish to GitHub Releases ----------------------------------
if [ -n "$RELEASE_TAG" ]; then
  log "Publishing to GitHub Release '$RELEASE_TAG' on $REPO"
  command -v gh >/dev/null 2>&1 || die "GitHub CLI 'gh' not found. Install it (https://cli.github.com) or upload the files manually."
  NOTES="Native Vault build for Linux (Ubuntu / Kubuntu). Verify with SHA256SUMS.txt."
  if gh release view "$RELEASE_TAG" --repo "$REPO" >/dev/null 2>&1; then
    gh release upload "$RELEASE_TAG" "${ARTS[@]}" dist/SHA256SUMS.txt --repo "$REPO" --clobber
  else
    gh release create "$RELEASE_TAG" "${ARTS[@]}" dist/SHA256SUMS.txt \
      --repo "$REPO" --title "Vault $RELEASE_TAG" --notes "$NOTES"
  fi
  ok "Uploaded. Direct link pattern:"
  for f in "${ARTS[@]}"; do
    printf '   https://github.com/%s/releases/download/%s/%s\n' "$REPO" "$RELEASE_TAG" "$(basename "$f")"
  done
fi

echo
ok "${BOLD}Done.${RST} Install the .deb with:  ${BOLD}sudo apt install ./$(cd dist && ls -1 *.deb 2>/dev/null | head -n1)${RST}"
echo "${DIM}Then launch “Vault” from your apps menu, or run: saleh-vault${RST}"
