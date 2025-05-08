import type { IncomingMessage, ServerResponse } from "node:http";
import { api } from "encore.dev/api";
import { loadInscription, loadPointerFromDNS } from "../lib.js";
import type { File } from "../models/models.js";

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

export const helloBitcoin = api(
	{ expose: true, method: "GET", path: "/encore-test-bitcoin" },
	async () => {
		await Promise.resolve();
		// Return a slightly more complex object
		return {
			message: "Hello from native Encore in BitcoinService!",
			data: {
				height: 123,
				hash: "abc",
				timestamp: Date.now(),
			},
			status: "OK",
		};
	},
);

export const getTxRoot = api.raw(
	{ expose: true, method: "GET", path: "/:txid" },
	async (req: IncomingMessage, resp: ServerResponse) => {
		let file: File | undefined;
		let pointer = "";
		try {
			if (!req.url) {
				throw new Error("Request URL is missing");
			}
			pointer = req.url.substring(1);

			const queryIndex = pointer.indexOf("?");
			if (queryIndex !== -1) {
				pointer = pointer.substring(0, queryIndex);
			}

			console.log(
				`Received raw request for root pointer: ${pointer} from req.url: ${req.url}`,
			);

			const meta = false;
			const fuzzy = true;

			file = await loadInscription(pointer, meta, fuzzy);

			if (!file || !file.data) {
				throw new Error("File data not found");
			}

			resp.writeHead(200, {
				"Content-Type": file.type || "application/octet-stream",
				"Content-Length": file.data.length,
				"Cache-Control": "public,immutable,max-age=31536000",
			});
			resp.end(file.data);
		} catch (error) {
			console.error(`Error loading inscription ${pointer}:`, error);
			resp.writeHead(404, { "Content-Type": "text/plain" });
			resp.end(`Not Found: ${(error as Error).message}`);
		}
	},
);
