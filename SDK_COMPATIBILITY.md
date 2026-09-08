# T3N SDK compatibility notes

Observed through official browser pages on 8 September 2026 UTC. This is source inspection, not an executed T3N integration. No SDK was installed and no authenticated session or protected contract was created.

## Pinned release

The sponsor discussion recommends SDK 5.2. The npm Code view for [@terminal3/t3n-sdk 5.2.0](https://www.npmjs.com/package/@terminal3/t3n-sdk/v/5.2.0) exposes package.json with version 5.2.0, ESM exports, and Node >=18. Its dependencies can impose higher runtime requirements; the package engine alone is not a validated runtime matrix.

The packaged dist/index.d.ts declares:

- `Environment = "sandbox" | "testnet" | "production"`. Select sandbox explicitly for sandbox credits; do not infer the network from changing examples.
- `loadWasmComponent(config?)` returns a WASM component.
- `fetchTrustedManifest(env, opts?)` returns a verified TrustAnchor or throws. The default trust root is the operator public key pinned by the SDK.
- `T3nClientConfig.trustAnchor` is required.
- `handshake()` returns a session result with an `authenticated` boolean. Handshake success must not be described as authentication.

## Documentation mismatch

The [signup page](https://terminal3.io/products/agent-developer-kit) showed a constructor with wasmComponent and EthSign handlers but without trustAnchor. That snippet does not meet the 5.2.0 declared constructor contract. The package README instead includes `trustAnchor: await fetchTrustedManifest("sandbox")`. Use the verified anchor path; do not disable attestation checks to make the sample run.

The packaged environment type includes testnet while the displayed npm README lists only sandbox and production. The public artifact comment describes testnet as its default. Explicit configuration avoids this ambiguity.

## Remaining acceptance work

1. Obtain legitimate sandbox credentials through the official signup; current in-app Google sign-in stalls without issuing credentials.
2. In an authorized development environment, lock the exact dependency graph and verify the supported Node runtime.
3. Load WASM and fetch a verified sandbox manifest, then complete handshake. Keep session identifiers out of public logs.
4. Authenticate with credentials held in a secret store, without printing keys or tokens.
5. Complete the official Quickstart and Walkthrough, deploy a protected review contract, and verify authorization, replay prevention, allowance accounting and durable state against the actual network.
6. Record run URLs and sanitized outcomes. Submit the bounty only after these requirements work.

## Verified core evidence

[GitHub-hosted regression run](https://github.com/pranavharan02/invoice-review-agent/actions/runs/34269089117): 22 tests passed, 0 failed, 0 skipped. This evidence covers only the dependency-free invoice review core. It does not establish TEE execution, agent registration, protected storage or bounty completion.
