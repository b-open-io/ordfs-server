# Ordfs-Server Encore Migration Plan

This document outlines the plan for migrating the `ordfs-server` from Express.js to Encore.ts.

## Service Structure

1.  **`bitcoinService`**
    *   **Purpose:** Handles all direct interactions with Bitcoin SV blockchain data, fetching and serving raw inscription content.
    *   **Endpoints:**
        *   `/:pointer` (Handles `/:txid` and `/:txid_vout`): Serves raw inscription content.
        *   `/content/:pointer` (Handles `/content/:txid` and `/content/:txid_vout`): Serves raw inscription content. (This is an alternative to the above, might be consolidated depending on routing capabilities).
        *   `/v1/bsv/block/latest`: Gets the latest block header.
        *   `/v1/bsv/block/height/:height`: Gets block header by height.
        *   `/v1/bsv/block/hash/:hash`: Gets block header by hash.
    *   **Status:** Partially implemented. Needs robust routing for pointer variations.

2.  **`apiService`** (or `gatewayService`)
    *   **Purpose:** Main public-facing interface. Serves the application's root page, handles user-friendly URLs, and orchestrates calls to other services.
    *   **Endpoints:**
        *   `/`: Serves `index.html`.
        *   `/:fileOrPointer`: Resolves various pointer types (TXID, TXID_VOUT, DNS names like `satoshi.bsv`) and serves the content, likely by calling `bitcoinService`.
        *   `/favicon.ico`, `/static/*`: Serves static assets.
    *   **Status:** Not yet implemented.

3.  **`inscriptionService`** (Optional - to be evaluated)
    *   **Purpose:** If inscription-specific logic (advanced parsing, metadata, search) becomes complex, it could be housed here.
    *   **Status:** Currently, logic is within `src/lib.js` and used by `bitcoinService`.

## Key Implementation Steps

1.  **Finalize `bitcoinService` Endpoints:**
    *   Ensure `/:pointer` and `/content/:pointer` routes correctly extract the `txid` or `txid_vout` and pass it to `loadInscription`.
    *   Confirm these endpoints work correctly via `curl`, including proper `Content-Type` and content delivery.
2.  **Implement `apiService` Root Endpoint (`/`):**
    *   Serve an `index.html` file (e.g., from a `public` or `static` directory).
3.  **Implement `apiService` `/:fileOrPointer` Endpoint:**
    *   This will be the core intelligent routing logic:
        *   Determine if `fileOrPointer` is a TXID/Outpoint.
        *   If so, call `bitcoinService` to get the content.
        *   If not, attempt DNS resolution via `loadPointerFromDNS`.
        *   If DNS resolves to a TXID/Outpoint, call `bitcoinService`.
        *   Handle all error cases gracefully (404s, etc.).
        *   This endpoint will likely need to be `api.raw` for full control over the response.
4.  **Static Asset Serving:**
    *   Configure Encore to serve static assets (CSS, JS, images) for `apiService`.
5.  **Resolve `Content-Length: 0` Mystery:**
    *   The issue where some native Encore endpoints return `Content-Length: 0` with `curl` (but work via the Encore dashboard) needs to be understood and fixed. The `/encore-test-bitcoin` endpoint in `bitcoinService` is key to diagnosing this.

## Known Issues / Questions

*   **`Content-Length: 0` with `curl`:** Affects some services/endpoints but not others.
*   **Encore API for Path Parameters in `api.raw`:** The `currentRequest()` / `APICallMeta` method caused errors. Currently using `req.url` parsing, but need to confirm if this is the best/most robust Encore-idiomatic approach for raw endpoints.
*   **Linter errors in `bitcoinService/index.ts`:** Unused `req`, `resp` parameters in `api.raw` handler (minor). 