# OrdFS Server

This project provides a server, built with [Encore.dev](https://encore.dev/), to serve websites and files inscribed on the Bitcoin SV blockchain. It supports resolving inscriptions via Transaction IDs (TXIDs), Outpoints (TXID_vout), and DNS-based pointers.

## Features

*   Serves inscription content directly from BSV.
*   Resolves pointers via TXID, Outpoint (e.g., `txid_0`), and DNS TXT records.
*   Built with Encore.ts for a modern, type-safe backend.
*   Includes basic block information endpoints (e.g., `/v1/bsv/block/latest`).

## Prerequisites

*   **Node.js** (v18+ recommended)
*   **Bun** (for package management and running scripts - `npm install -g bun`)
*   **Encore CLI:** Follow the installation instructions at [encore.dev/docs/install](https://encore.dev/docs/install).
*   **Docker Desktop:** Required by Encore for running local development services (like databases, if used - Redis is used by this project for caching). Ensure Docker is running.

## Getting Started

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd ordfs-server
    ```

2.  **Install dependencies:**
    ```bash
    bun install
    ```

3.  **Initialize Encore (if first time running an Encore app):**
    You might need to run `encore auth login` if you haven't used Encore before.

4.  **Run the server:**
    ```bash
    encore run
    ```
    This will start the Encore development server, typically at `http://localhost:4000`. You'll also get a link to the Encore local development dashboard (usually `http://localhost:9400`).

## Usage

Once the server is running:

*   **Root Page:** Navigate to `http://localhost:4000/` to view the main page.
*   **Fetch Inscription by TXID/Outpoint:**
    *   `http://localhost:4000/<txid>`
    *   `http://localhost:4000/<txid_vout>` (e.g., `http://localhost:4000/c7464f399365837cb6f72820f63a37f0709dd9f45f771243ebbac1d07716d72a_0`)
*   **Fetch Inscription by DNS Pointer:**
    *   `http://localhost:4000/<your.dns.pointer>` (e.g., `http://localhost:4000/satoshi.bsv`)
*   **Block Information:**
    *   `http://localhost:4000/v1/bsv/block/latest`
    *   `http://localhost:4000/v1/bsv/block/height/:height`
    *   `http://localhost:4000/v1/bsv/block/hash/:hash`

### DNS Registration for Pointers

To use DNS pointers:

1.  Ensure your domain's `A` or `CNAME` record points to the server where this Ordfs instance is running.
2.  Create a `TXT` record for the domain/subdomain you wish to use. The `TXT` record should point to the Inscription ID (TXID or Outpoint) that serves as the content for that name.
    *   Format: `ordfs=<InscriptionID>`
    *   Hostname: Prefix the hostname with `_ordfs.`. For example, if your pointer is `mypointer.example.com`, the TXT record should be for `_ordfs.mypointer.example.com`.

## Project Structure & Architecture

The server is built using Encore and is structured into services:

*   **`apiService`**: Handles incoming user requests, routing, serving the main HTML page, and orchestrating calls to other services.
*   **`bitcoinService`**: Responsible for direct interaction with BSV data sources, fetching inscription content, and providing block information.

For more details on the migration and architecture, see `plan.md`.

## Deployment

For deploying to DigitalOcean's App Platform, refer to the detailed guide: [Deploying to DigitalOcean App Platform](./DigitalOceanApp.md).

## Configuration

*   **Redis for Caching:** The application uses Redis for caching inscription data. Encore manages the Redis instance locally when you run `encore run` (via Docker). For cloud deployments, Encore can provision Redis.
*   **Node Configuration (Legacy):** The previous Express version used environment variables like `BTC_HOST`, `BITCOIN_HOST`, etc., for connecting to Bitcoin nodes. The current Encore version primarily uses public APIs (ord.io, 1sat.app) for data fetching, defined in `src/data.ts`. Direct node connections are not currently implemented in this version but could be added if needed.

## Linting and Formatting

This project uses Biome for linting and formatting.
```bash
bun lint
bun format
# To fix issues:
bun lint:fix
bun lint:fix:unsafe
```
