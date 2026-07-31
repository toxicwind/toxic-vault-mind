#!/usr/bin/env bash
# Optionally install the Modal CLI and print the manual steps required to deploy embedding.

set -euo pipefail

usage() {
	echo "Usage: $0 [--install]" >&2
}

install=false

while [ "$#" -gt 0 ]; do
	case "$1" in
		--install)
			if [ "$install" = true ]; then
				usage
				exit 2
			fi
			install=true
			shift
			;;
		*)
			usage
			exit 2
			;;
	esac
done

if [ "$install" = true ]; then
	uv tool install modal
	cat <<'EOF'

Modal CLI installation completed. No deployment, secret creation, or vault mutation was performed.
EOF
else
	cat <<'EOF'

No Modal CLI installation, deployment, secret creation, environment mutation, or vault mutation was performed. To install the CLI, rerun with:
   ./scripts/install-modal.sh --install
EOF
fi

cat <<'EOF'

Complete these steps manually:

1. Authenticate the CLI by running:
   modal token new

2. Accept the gated EmbeddingGemma license on huggingface.co, then create a Hugging Face read token.

3. Generate one service token and create the two required Modal secrets:
   export MODAL_EMBEDDING_TOKEN="$(openssl rand -hex 32)"
   modal secret create pi-vault-mind-auth API_TOKEN="$MODAL_EMBEDDING_TOKEN"
   modal secret create huggingface-secret HF_TOKEN=hf_xxx

4. Deploy the embedding service from this repository by running:
   modal deploy modal/app.py

5. Configure Remote URL with the deployed endpoint:
   https://kylebrodeur--pi-vault-mind-embed-embeddingservice-fastapi-app.modal.run

6. Paste the same MODAL_EMBEDDING_TOKEN into Remote API key, or use the Remote read API key and Remote write API key fields for scoped tokens.

7. Select Test & Fetch Models. Use the displayed error to troubleshoot the endpoint or token.
EOF
