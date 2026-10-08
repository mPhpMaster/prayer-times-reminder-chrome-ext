#!/usr/bin/env bash
# Prayer Times Break — Discord (Vencord) plugin setup for macOS and Linux.
#
# Run:  bash install.sh
# Without this repository:
#   curl -fsSL https://raw.githubusercontent.com/mPhpMaster/prayer-times-reminder-chrome-ext/main/targets/vencord/install.sh | bash
#
# Installs what is missing (Git, Node.js 22+ via nvm, pnpm), then runs
# installer.mjs, which installs, updates or removes the plugin (and Vencord).
# Extra arguments go to installer.mjs (--install, --update, --remove, --status, --yes).

set -euo pipefail
REPO_URL="https://github.com/mPhpMaster/prayer-times-reminder-chrome-ext.git"
NVM_VERSION="v0.40.3"

case "${LANG:-}${LC_ALL:-}" in ar*|*:ar*) AR=1 ;; *) AR=0 ;; esac
export PTB_LANG=$([ "$AR" = 1 ] && echo ar || echo en)

say() { if [ "$AR" = 1 ]; then printf '\033[36m%s\033[0m\n' "$2"; else printf '\033[36m%s\033[0m\n' "$1"; fi; }
fail() { say "$1" "$2"; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

# Installs a system package with whatever package manager this machine has.
install_pkg() {
  if [ "$(uname -s)" = Darwin ]; then
    if have brew; then brew install "$1"; else xcode-select --install || true; fi
  elif have apt-get; then sudo apt-get update && sudo apt-get install -y "$1"
  elif have dnf; then sudo dnf install -y "$1"
  elif have pacman; then sudo pacman -S --noconfirm "$1"
  elif have zypper; then sudo zypper install -y "$1"
  else return 1
  fi
}

node_major() { if have node; then node -v | sed 's/^v//; s/\..*//'; else echo 0; fi; }

# 1. Git (on macOS /usr/bin/git is only a stub until the Command Line Tools exist)
if ! git --version >/dev/null 2>&1; then
  say "Installing Git..." "جارٍ تثبيت Git..."
  install_pkg git || fail "Install Git (https://git-scm.com), then run this again." "ثبّت Git من https://git-scm.com ثم شغّل هذا مرة أخرى."
  git --version >/dev/null 2>&1 || fail "Finish installing Git, then run this again." "أكمل تثبيت Git ثم شغّل هذا مرة أخرى."
fi

# 2. Node.js 22 or newer (Vencord needs it), through nvm in your home folder
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ "$(node_major)" -lt 22 ]; then
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  if [ "$(node_major)" -lt 22 ]; then
    say "Installing Node.js 22..." "جارٍ تثبيت Node.js 22..."
    if ! [ -s "$NVM_DIR/nvm.sh" ]; then
      have curl || install_pkg curl || fail "Install curl, then run this again." "ثبّت curl ثم شغّل هذا مرة أخرى."
      curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/$NVM_VERSION/install.sh" | bash
      # shellcheck disable=SC1091
      . "$NVM_DIR/nvm.sh"
    fi
    nvm install 22
    nvm use 22 >/dev/null
  fi
fi

# 3. pnpm (Vencord's package manager)
if ! have pnpm; then
  say "Installing pnpm..." "جارٍ تثبيت pnpm..."
  npm install -g pnpm || sudo npm install -g pnpm
fi

# 4. The plugin's source: this repository, or a fresh copy of it
ROOT=""
SELF="${BASH_SOURCE[0]:-}"
if [ -n "$SELF" ] && [ -f "$SELF" ]; then
  CANDIDATE="$(cd "$(dirname "$SELF")/../.." && pwd)"
  [ -f "$CANDIDATE/tools/sync-core.mjs" ] && ROOT="$CANDIDATE"
fi
if [ -z "$ROOT" ]; then
  say "Downloading the plugin..." "جارٍ تنزيل الإضافة..."
  ROOT="${TMPDIR:-/tmp}/prayer-times-break-src"
  rm -rf "$ROOT"
  git clone --depth 1 "$REPO_URL" "$ROOT" || fail "Download failed; check the internet connection." "فشل التنزيل؛ تحقّق من الاتصال بالإنترنت."
fi

# Read answers from the keyboard even when this script came through a pipe.
if [ -t 0 ]; then
  exec node "$ROOT/targets/vencord/installer.mjs" "$@"
else
  exec node "$ROOT/targets/vencord/installer.mjs" "$@" </dev/tty
fi
