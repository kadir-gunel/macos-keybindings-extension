.PHONY: all install clean package

all: package

# Build package for current system (Arch Linux)
package:
	@echo "Building package for $(shell uname -s)..."
	@if command -v makepkg >/dev/null 2>&1; then \
		makepkg -f; \
	else \
		echo "Error: makepkg not found. Install base-devel package group."; \
		exit 1; \
	fi

# Install the package
install: package
	@if command -v pacman >/dev/null 2>&1; then \
		sudo pacman -U macos-keybindings-extension-*.pkg.tar.zst; \
	else \
		echo "Error: pacman not found. This target is for Arch Linux."; \
		exit 1; \
	fi

# Clean build artifacts
clean:
	rm -rf *.pkg.tar.zst *.src.tar.gz *.log src/ pkg/

# Generate schema from gschema.xml
schemas:
	glib-compile-schemas schemas/

# Run shellcheck on all JS files
lint:
	find . -name '*.js' -type f | xargs shellcheck -x
