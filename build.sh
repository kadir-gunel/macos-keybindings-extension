#!/bin/bash
# Build packages for local testing

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/build"

mkdir -p "${BUILD_DIR}"

echo "Building macOS Keybindings Extension packages..."

# Check if Docker is available for building different distro packages
if ! command -v docker &> /dev/null; then
    echo "Docker not found. Please install Docker to build packages for multiple distributions."
    echo "For Arch Linux (current system), you can build an Arch package:"
    echo ""
    echo "  makepkg -f"
    exit 1
fi

# Check if user is in docker group
if ! groups | grep -q docker; then
    echo "Warning: User is not in the docker group. Try:"
    echo "  sudo usermod -aG docker \$USER"
    echo "  newgrp docker"
    echo ""
    echo "Or run this script with sudo (not recommended)."
    exit 1
fi

# Build Arch package
echo "Building Arch package..."
docker run --rm -v "${SCRIPT_DIR}:/app" -w /app archlinux/archlinux:latest bash -c "
  pacman -Syu --needed --noconfirm base-devel shellcheck
  wget -q https://gitlab.gnome.org/GNOME/gnome-shell/-/raw/main/data/org.gnome.shell.Extensions.gschema.xml -O schemas/org.gnome.shell.Extensions.gschema.xml
  ARCHPKG_VERSION=\$(git describe --tags --abbrev=0 2>/dev/null || echo 'v1.0.0')
  ARCHPKG_VERSION=\${ARCHPKG_VERSION#v}
  mkdir -p build/arch
  cd build/arch
  cat > PKGBUILD << 'PKGBUILDFILE'
pkgname=macos-keybindings-extension
pkgver=\"${ARCHPKG_VERSION}\"
pkgrel=1
pkgdesc=\"macOS-style keyboard shortcuts for GNOME Shell\"
arch=(x86_64)
url=\"https://github.com/kadir-gunel/macos-keybindings-extension\"
license=('GPL-3.0-or-later')
depends=('gnome-shell>=51.0')
makedepends=('git')
source=(\"${pkgname}-${pkgver}.tar.gz\"::\"https://github.com/kadir-gunel/macos-keybindings-extension/archive/\${pkgver}.tar.gz\")
sha256sums=('SKIP')

prepare() {
  cd \"\${pkgname}-${pkgver}\"
  find . -name '*.js' -exec shellcheck -x {} +
}

package() {
  cd \"\${pkgname}-${pkgver}\"
  install -d \"\${pkgdir}/usr/share/gnome-shell/extensions/\${pkgname}\"
  cp -r * \"\${pkgdir}/usr/share/gnome-shell/extensions/\${pkgname}\"
  install -Dm644 schemas/*.xml \"\${pkgdir}/usr/share/glib-2.0/schemas/\"
  glib-compile-schemas \"\${pkgdir}/usr/share/glib-2.0/schemas/\"
}
PKGBUILDFILE
  makepkg -f --noconfirm
  cp *.pkg.tar.zst ../
"
cp "${BUILD_DIR}/arch"/*.pkg.tar.zst "${BUILD_DIR}/" 2>/dev/null || true

echo "Build complete! Packages are in ${BUILD_DIR}/"
ls -lh "${BUILD_DIR}/"*.pkg.tar.zst 2>/dev/null || echo "No Arch package found (requires makepkg)"
