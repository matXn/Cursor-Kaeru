.PHONY: check dev-web dev-server dev-desktop build-web build-server build-desktop build-docker

DESKTOP := pnpm --dir apps/desktop

check:
	cargo fmt --all -- --check
	cargo clippy --workspace --all-targets -- -D warnings
	cargo test --workspace --all-targets
	$(DESKTOP) run check

dev-web:
	$(DESKTOP) run dev:web

dev-server:
	CURSOR_CONSOLE_DIR=apps/desktop/dist cargo run --package cursor-server --bin cursor-server

dev-desktop:
	$(DESKTOP) run tauri:dev

build-web:
	$(DESKTOP) run build

build-server:
	cargo build --release --package cursor-server --bin cursor-server

# Windows ships an NSIS installer only; other platforms use Tauri's default bundles.
ifeq ($(OS),Windows_NT)
build-desktop:
	$(DESKTOP) exec tauri build --bundles nsis
else
build-desktop:
	$(DESKTOP) run tauri:build
endif

build-docker:
	docker build --tag cursor-kaeru:local .
