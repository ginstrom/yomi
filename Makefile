IMAGE       := localhost/yomi-dev:latest
NODE_MODULES_VOLUME := yomi-node-modules
PORT        := 5173

PODMAN_RUN := podman run --rm -v $(CURDIR):/app -v $(NODE_MODULES_VOLUME):/app/node_modules -w /app

.PHONY: help
help: ## Show this help
	@echo "Targets:"
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

.PHONY: build
build: ## Build the podman dev image
	podman build -t $(IMAGE) -f Containerfile .

.PHONY: run
run: build ## Run the dev server in podman (http://localhost:5173)
	$(PODMAN_RUN) -it -p $(PORT):5173 $(IMAGE) npm run dev -- --host --port $(PORT)

.PHONY: test
test: build ## Run the test suite (in podman)
	$(PODMAN_RUN) $(IMAGE) npm test

.PHONY: install
install: build ## Install/update npm dependencies (in podman)
	$(PODMAN_RUN) $(IMAGE) npm install

.PHONY: shell
shell: build ## Open a shell in the dev container
	$(PODMAN_RUN) -it $(IMAGE) bash

.PHONY: clean
clean: ## Remove the dev image and node_modules volume
	podman rmi -f $(IMAGE) 2>/dev/null || true
	podman volume rm -f $(NODE_MODULES_VOLUME) 2>/dev/null || true
