# Packaging

This project provides CI/CD for building packages for multiple distributions and a local build script.

## CI/CD

Packages are built automatically on GitHub Actions when you push a tag (e.g., `v1.0.0`).

The following packages are built:
- **Arch Linux** (.pkg.tar.zst)
- **Debian/Ubuntu** (.deb)
- **Fedora** (.rpm)

Artifacts are available in the GitHub Actions workflow run.

## Local Building

### For Arch Linux (current system)

```bash
# Install build dependencies
sudo pacman -S base-devel shellcheck git

# Build package
makepkg -f

# Install
sudo pacman -U macos-keybindings-extension-*.pkg.tar.zst
```

### Using Docker (build for multiple distributions)

```bash
# Build all packages
./build.sh

# Build specific distro
docker run --rm -v "$(pwd):/app" -w /app ubuntu:22.04 bash -c "
  apt-get update && apt-get install -y build-essential shellcheck
  wget -q https://gitlab.gnome.org/GNOME/gnome-shell/-/raw/main/data/org.gnome.shell.Extensions.gschema.xml -O schemas/org.gnome.shell.Extensions.gschema.xml
  # Build DEB package
  # ... (similar to workflow)
"
```

### Manual package structure

The extension package must contain:
1. Extension files in `/usr/share/gnome-shell/extensions/<uuid>/`
2. GSettings schema in `/usr/share/glib-2.0/schemas/`
3. Proper metadata.json with `shell-version: ["50", "51"]`

Example:
```bash
makepkg -f  # Arch
dpkg-deb -b debian macos-keybindings-extension.deb  # DEB
rpmbuild -bb macos-keybindings-extension.spec  # RPM
```

## Testing packages

After installing a package, reload GNOME Shell:
```bash
# If running in a display manager
rm -rf ~/.local/share/gnome-shell/extensions/<uuid>/.installed
gnome-shell --replace

# Or log out and back in
```

## License

The extension is GPL-3.0-or-later. The packaging scripts are in the public domain.
