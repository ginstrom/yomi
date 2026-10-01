IMAGE       := localhost/yomi-dev:latest
NODE_MODULES_VOLUME := yomi-node-modules
PORT        := 5173

PODMAN_RUN := podman run --rm -v $(CURDIR):/app -v $(NODE_MODULES_VOLUME):/app/node_modules -w /app

# node_modules lives in a named volume that outlives image rebuilds, so it
# goes stale when package-lock.json changes. Before running a command,
# reinstall if the lockfile differs from the copy stamped at the last install.
# (npm install rather than npm ci: ci tries to delete node_modules, which is
# a mount point here.)
LOCK_STAMP := node_modules/.package-lock.stamp
WITH_DEPS  := sh -c '(cmp -s package-lock.json $(LOCK_STAMP) || { npm install --no-audit --no-fund && cp package-lock.json $(LOCK_STAMP); }) && exec "$$@"' --

.PHONY: help
help: ## Show this help
	@echo "Targets:"
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

.PHONY: build
build: ## Build the podman dev image
	podman build -t $(IMAGE) -f Containerfile .

.PHONY: run
run: build ## Run the dev server in podman (http://localhost:5173)
	$(PODMAN_RUN) -it -p $(PORT):5173 $(IMAGE) $(WITH_DEPS) npx vite --host --port $(PORT)

.PHONY: test
test: build ## Run the test suite (in podman)
	$(PODMAN_RUN) $(IMAGE) $(WITH_DEPS) npm test

.PHONY: simulate
simulate: build ## Run headless battle simulations, e.g. make simulate ARGS="--battles 5000 --seed 1"
	$(PODMAN_RUN) $(IMAGE) $(WITH_DEPS) node scripts/simulate.ts $(ARGS)

.PHONY: install
install: build ## Install/update npm dependencies (in podman)
	$(PODMAN_RUN) $(IMAGE) sh -c 'npm install --no-audit --no-fund && cp package-lock.json $(LOCK_STAMP)'

.PHONY: shell
shell: build ## Open a shell in the dev container
	$(PODMAN_RUN) -it $(IMAGE) bash

.PHONY: clean
clean: ## Remove the dev image and node_modules volume
	podman rmi -f $(IMAGE) 2>/dev/null || true
	podman volume rm -f $(NODE_MODULES_VOLUME) 2>/dev/null || true
