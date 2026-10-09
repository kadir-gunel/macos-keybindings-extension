# Packaging

This project provides CI/CD for building packages and releasing them to GitHub.

## Releases and Packages

When you push a version tag (e.g., `v1.0.0`), GitHub Actions will:

1. Build three package types:
   - **Arch Linux** (.pkg.tar.zst)
   - **Debian/Ubuntu** (.deb)
   - **Fedora** (.rpm)

2. Upload the built packages to the **GitHub Release** as attachments

3. Upload artifacts to Actions (7-day retention)

## Releasing a new version

### Option 1: Automatic release (recommended)

```bash
# 1. Update version in metadata.json
#    Change "version": "1.0.0" to "1.1.0"

# 2. Commit and push
git add metadata.json
git commit -m "Bump version to 1.1.0"
git push

# 3. Create and push tag
git tag -a "v1.1.0" -m "Release 1.1.0 for GNOME 51"
git push origin "v1.1.0"
```

GitHub Actions will automatically build packages and create a release.

### Option 2: Manual release

If you need more control, you can skip the CI/CD and create the release manually:

```bash
# 1. Build the extension zip locally
tar -czf macos-keybindings-extension-1.1.0.tar.gz metadata.json extension.js prefs.js schemas/*.xml stylesheet.css lib/ icons/

# 2. Upload to GitHub as a release asset
#    Go to the Releases page and upload the zip file manually
```

## Downloading packages

1. Go to the **Releases** tab in the repository
2. Click on the release (e.g., "v1.1.0")
3. Scroll down to **Assets**
4. Download the package for your distribution:
   - `macos-keybindings-extension-1.1.0-1-x86_64.pkg.tar.zst` → Arch Linux
   - `macos-keybindings-extension_1.1.0-1_amd64.deb` → Debian/Ubuntu
   - `macos-keybindings-extension-1.1.0-1.fc40.noarch.rpm` → Fedora

## Installing packages

### Arch Linux

```bash
sudo pacman -U macos-keybindings-extension-*.pkg.tar.zst
```

### Debian/Ubuntu

```bash
sudo dpkg -i macos-keybindings-extension_*.deb
sudo apt-get install -f  # Fix missing dependencies
```

### Fedora

```bash
sudo dnf install macos-keybindings-extension-*.rpm
```

### Manual installation (from zip)

```bash
# Unzip to the extensions directory
unzip macos-keybindings-extension-*.zip -d ~/.local/share/gnome-shell/extensions/

# Reload GNOME Shell
rm -rf ~/.local/share/gnome-shell/extensions/macos-keybindings@kguenel.github.io/.installed
gnome-shell --replace
```

## Local building

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
  # Build DEB package
  # ... (similar to workflow)
"
```

### Makefile targets

```makefile
make           # Build package for current system
make install   # Build and install package
make clean     # Clean build artifacts
make lint      # Run shellcheck on JS files
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

## Troubleshooting

### Packages not appearing in release

- Check the Actions tab for build failures
- Verify the tag format: `vX.Y.Z` (e.g., `v1.0.0`)
- Ensure you pushed to `origin` (not just a local tag)

### Dependency errors

- Make sure GNOME Shell 51+ is installed
- Ensure the `input` group membership for user (required for `/dev/uinput`)

### Extension not loading

- Check GNOME Shell logs: `journalctl -f`
- Verify extension is enabled in GNOME Shell settings
- Check for syntax errors in `extension.js` using `gjs --validate extension.js`
