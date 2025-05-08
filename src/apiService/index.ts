import { readFile } from "node:fs/promises";
// import server from "../server.js"; // Commented out Express app import
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import ejs from "ejs"; // Import ejs
import { api } from "encore.dev/api";
import * as bitcoinService from "../bitcoinService/index.js"; // Import the bitcoinService
import { loadPointerFromDNS } from "../lib.js";

/*
export const hello = api({ expose: true, method: "GET", path: "/encore-test" }, async () => {
    await Promise.resolve();
    // Return a slightly more complex object
    return {
        message: "Hello from native Encore!",
        data: {
            height: 123,
            hash: "abc",
            timestamp: Date.now()
        },
        status: "OK"
    };
});
*/

// Ensure Express app can handle requests forwarded by Encore
// This might require prototype adjustments depending on Express/Encore interaction
// Object.setPrototypeOf(IncomingMessage.prototype, server.request);
// Object.setPrototypeOf(ServerResponse.prototype, server.response);

/*
export const fallback = api.raw(
    {
        expose: true,
        method: "*", // Catch all methods
        path: "/!path", // Encore's wildcard fallback path
    },
    async (req: IncomingMessage, resp: ServerResponse) => {
        // Directly pass the request to the Express app instance
        server(req, resp);
    }
); 
*/

// Regular expression to check for typical TXID or Outpoint format
// (64 hex chars, optionally followed by _ and one or more digits)
const txidRegex = /^[a-fA-F0-9]{64}(_[0-9]+)?$/;

// Serves the main index.html page using EJS
export const getRoot = api.raw(
	{ expose: true, method: "GET", path: "/" },
	async (_req: IncomingMessage, resp: ServerResponse) => {
		try {
			const viewPath = join(process.cwd(), "views", "pages", "index.ejs");
			// Data to pass to the EJS template
			const templateData = {
				process: {
					env: {
						ORDFS_NAME: process.env.ORDFS_NAME || "Ordfs Server", // Provide default
					},
				},
			};
			// EJS options - specifying the root directory for includes
			const ejsOptions: ejs.Options = {
				root: join(process.cwd(), "views"), // Allows includes like <%- include('../partials/head'); %>
			};

			const html = await ejs.renderFile(viewPath, templateData, ejsOptions);

			resp.writeHead(200, {
				"Content-Type": "text/html",
				// Content-Length is tricky with dynamic rendering, let Node.js handle it by default
			});
			resp.end(html);
		} catch (error) {
			console.error("Error rendering index.ejs:", error);
			resp.writeHead(500, { "Content-Type": "text/plain" });
			resp.end("Internal Server Error rendering template");
		}
	},
);

// Serves favicon.ico
export const getFavicon = api.raw(
	{ expose: true, method: "GET", path: "/favicon.ico" },
	async (_req: IncomingMessage, resp: ServerResponse) => {
		try {
			const filePath = join(process.cwd(), "public", "favicon.ico");
			// Determine content type based on file extension, default to image/x-icon
			// For simplicity, we'll assume it's always .ico for favicon.ico
			const contentType = "image/x-icon";
			const fileData = await readFile(filePath);

			resp.writeHead(200, {
				"Content-Type": contentType,
				"Content-Length": fileData.length,
			});
			resp.end(fileData);
		} catch (error) {
			// If favicon.ico is not found, it's common to return a 204 No Content
			// or a 404. For simplicity, let's do 404 if it's truly missing.
			console.warn("favicon.ico not found:", error);
			resp.writeHead(404, { "Content-Type": "text/plain" });
			resp.end("Not Found");
		}
	},
);

// Handles /:fileOrPointer for inscriptions, outpoints, or DNS names
export const getFileOrPointer = api.raw(
	{ expose: true, method: "GET", path: "/:fileOrPointer" },
	async (req: IncomingMessage, resp: ServerResponse) => {
		let fop = ""; // fileOrPointer
		try {
			if (!req.url) {
				throw new Error("Request URL is missing");
			}
			fop = req.url.substring(1);
			const queryIndex = fop.indexOf("?");
			if (queryIndex !== -1) {
				fop = fop.substring(0, queryIndex);
			}

			console.log(`apiService: Received request for fileOrPointer: ${fop}`);

			let finalPointer = "";

			if (txidRegex.test(fop)) {
				console.log(`apiService: ${fop} looks like a TXID/Outpoint.`);
				finalPointer = fop;
			} else {
				console.log(
					`apiService: ${fop} does not look like a TXID/Outpoint, attempting DNS lookup.`,
				);
				try {
					const dnsPointer = await loadPointerFromDNS(fop);
					if (dnsPointer && dnsPointer.length > 0) {
						// dnsPointer might be an array, or a single string, lib.ts is a bit ambiguous
						// Assuming it returns a single valid pointer string or throws
						finalPointer = Array.isArray(dnsPointer)
							? dnsPointer[0]
							: dnsPointer;
						console.log(
							`apiService: DNS lookup for ${fop} resolved to: ${finalPointer}`,
						);
						if (!txidRegex.test(finalPointer)) {
							console.error(
								`apiService: DNS resolved to non-TXID format: ${finalPointer}`,
							);
							throw new Error(
								"DNS resolution did not return a valid TXID/Outpoint format.",
							);
						}
					} else {
						throw new Error("DNS lookup failed or returned empty.");
					}
				} catch (dnsError) {
					console.error(`apiService: DNS lookup for ${fop} failed:`, dnsError);
					resp.writeHead(404, { "Content-Type": "text/plain" });
					resp.end(
						`Not Found: DNS lookup failed for ${fop}. ${(dnsError as Error).message}`,
					);
					return;
				}
			}

			if (!finalPointer) {
				resp.writeHead(404, { "Content-Type": "text/plain" });
				resp.end(`Not Found: Could not determine a valid pointer from ${fop}`);
				return;
			}

			// Call bitcoinService to get the content
			console.log(
				`apiService: Calling bitcoinService with pointer: ${finalPointer}`,
			);
			const result =
				await bitcoinService.loadAndPrepareInscriptionExported(finalPointer);

			if ("error" in result) {
				console.error(
					`apiService: Error from bitcoinService for ${finalPointer}:`,
					result.error,
				);
				resp.writeHead(result.statusCode, { "Content-Type": "text/plain" });
				// Ensure result.error is an Error instance before accessing .message
				const errorMessage =
					result.error instanceof Error
						? result.error.message
						: String(result.error);
				resp.end(`Error: ${errorMessage}`);
				return;
			}

			console.log(
				`apiService: Successfully got data from bitcoinService for ${finalPointer}`,
			);
			resp.writeHead(200, result.headers);
			resp.end(result.file.data);
		} catch (error) {
			console.error(
				`apiService: Critical error in getFileOrPointer handler for ${fop}:`,
				error,
			);
			resp.writeHead(500, { "Content-Type": "text/plain" });
			resp.end("Internal Server Error");
		}
	},
);
