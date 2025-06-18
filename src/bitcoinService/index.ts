import type { IncomingMessage, ServerResponse } from "node:http";
import { api } from "encore.dev/api";
import { loadInscription, loadPointerFromDNS } from "../lib.js";
import type { File } from "../models/models.js";

// Internal helper to load inscription and prepare response parts
// Renamed to be exported for use by apiService
export async function loadAndPrepareInscriptionExported(
	pointer: string,
): Promise<
	| { file: File; headers: Record<string, string | number> }
	| { error: any; statusCode: number }
> {
	try {
		const fuzzy = true;
		const file = await loadInscription(pointer, fuzzy);

		if (!file || !file.data) {
			return { error: new Error("File data not found"), statusCode: 404 };
		}

		const headers = {
			"Content-Type": file.type || "application/octet-stream",
			"Content-Length": file.data.length,
			"Cache-Control": "public,immutable,max-age=31536000",
		};
		return { file, headers };
	} catch (error) {
		console.error(`Error in _loadAndPrepareInscription for ${pointer}:`, error);
		// Check if the error has a specific status code, e.g. from a fetch response
		// This is a simplistic check; real-world might need more robust error handling
		if (error && typeof (error as any).status === "number") {
			return { error, statusCode: (error as any).status };
		}
		if (error && (error as Error).message?.includes("Not found")) {
			// Heuristic for 404 from lib
			return { error, statusCode: 404 };
		}
		return { error, statusCode: 500 };
	}
}

export interface BlockHeader {
	height: number;
	hash: string;
	version: number;
	merkleRoot: string;
	creationTimestamp: number;
	bits: number;
	nonce: number;
	prevBlockHash: string;
}

export const chaintip = api(
	{ expose: true, method: "GET", path: "/v1/bsv/block/latest" },
	async (): Promise<BlockHeader> => {
		const resp = await fetch("https://ordinals.1sat.app/v5/blocks/tip");
		if (!resp.ok) {
			throw new Error(`Failed to fetch block header: ${resp.statusText}`);
		}
		return (await resp.json()) as BlockHeader;
	},
);

export const byHeight = api(
	{ expose: true, method: "GET", path: "/v1/bsv/block/height/:height" },
	async ({ height }: { height: number }): Promise<BlockHeader> => {
		const resp = await fetch(
			`https://ordinals.1sat.app/v5/blocks/height/${height}`,
		);
		if (!resp.ok) {
			throw new Error(`Failed to fetch block header: ${resp.statusText}`);
		}
		return (await resp.json()) as BlockHeader;
	},
);

export const byHash = api(
	{ expose: true, method: "GET", path: "/v1/bsv/block/hash/:hash" },
	async ({ hash }: { hash: string }): Promise<BlockHeader> => {
		const resp = await fetch(
			`https://ordinals.1sat.app/v5/blocks/hash/${hash}`,
		);
		if (!resp.ok) {
			throw new Error(`Failed to fetch block header: ${resp.statusText}`);
		}
		return (await resp.json()) as BlockHeader;
	},
);

// Handles /:txid or /:txid_vout
export const getPointerRoot = api.raw(
	{ expose: true, method: "GET", path: "/internal/bitcoin/pointer/:pointer" },
	async (req: IncomingMessage, resp: ServerResponse) => {
		let ptr = "";
		try {
			if (!req.url) {
				throw new Error("Request URL is missing");
			}
			// req.url will be /internal/bitcoin/pointer/<actual_pointer_value>
			const prefix = "/internal/bitcoin/pointer/";
			if (req.url.startsWith(prefix)) {
				ptr = req.url.substring(prefix.length);
			} else {
				// Fallback if something unexpected happens with routing, take last part
				ptr = req.url.substring(req.url.lastIndexOf("/") + 1);
			}

			const queryIndex = ptr.indexOf("?");
			if (queryIndex !== -1) {
				ptr = ptr.substring(0, queryIndex);
			}
			console.log(
				`Received raw request for root pointer: ${ptr} from req.url: ${req.url}`,
			);

			const result = await loadAndPrepareInscriptionExported(ptr);

			if ("error" in result) {
				resp.writeHead(result.statusCode, { "Content-Type": "text/plain" });
				resp.end(`Error: ${(result.error as Error).message}`);
				return;
			}

			resp.writeHead(200, result.headers);
			resp.end(result.file.data);
		} catch (error) {
			console.error(
				`Critical error in getPointerRoot handler for ${ptr}:`,
				error,
			);
			resp.writeHead(500, { "Content-Type": "text/plain" });
			resp.end("Internal Server Error");
		}
	},
);

// Handles /content/:txid or /content/:txid_vout
export const getContentPointerRoot = api.raw(
	{ expose: true, method: "GET", path: "/internal/bitcoin/content/:pointer" },
	async (req: IncomingMessage, resp: ServerResponse) => {
		let ptr = "";
		try {
			if (!req.url) {
				throw new Error("Request URL is missing");
			}
			// req.url will be /internal/bitcoin/content/<actual_pointer_value>
			const prefix = "/internal/bitcoin/content/";
			if (req.url.startsWith(prefix)) {
				ptr = req.url.substring(prefix.length);
			} else {
				// Fallback
				ptr = req.url.substring(req.url.lastIndexOf("/") + 1);
			}

			const queryIndex = ptr.indexOf("?");
			if (queryIndex !== -1) {
				ptr = ptr.substring(0, queryIndex);
			}
			console.log(
				`Received raw request for content pointer: ${ptr} from req.url: ${req.url}`,
			);

			const result = await loadAndPrepareInscriptionExported(ptr);

			if ("error" in result) {
				resp.writeHead(result.statusCode, { "Content-Type": "text/plain" });
				resp.end(`Error: ${(result.error as Error).message}`);
				return;
			}

			resp.writeHead(200, result.headers);
			resp.end(result.file.data);
		} catch (error) {
			console.error(
				`Critical error in getContentPointerRoot handler for ${ptr}:`,
				error,
			);
			resp.writeHead(500, { "Content-Type": "text/plain" });
			resp.end("Internal Server Error");
		}
	},
);
