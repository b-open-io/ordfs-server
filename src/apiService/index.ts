import { readFile } from "node:fs/promises";
// import server from "../server.js"; // Commented out Express app import
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import ejs from "ejs"; // Import ejs
import { api } from "encore.dev/api";
import * as bitcoinService from "../bitcoinService/index.js"; // Import the bitcoinService
import { loadInscription, loadPointerFromDNS, sendFile } from "../lib.js";


// Regular expression to check for typical TXID or Outpoint format
// (64 hex chars, optionally followed by _ and one or more digits)
const txidRegex = /^[a-fA-F0-9]{64}(_[0-9]+)?$/;

const { ORDFS_DOMAINS, ORDFS_HOST } = process.env;

// --- Helper Function ---
// Handles calling bitcoinService and sending the response/error
async function _handlePointerLookup(pointer: string, resp: ServerResponse) {
	console.log(
		`apiService: [_handlePointerLookup] Calling bitcoinService with pointer: ${pointer}`,
	);
	try {
		const result =
			await bitcoinService.loadAndPrepareInscriptionExported(pointer);

		if ("error" in result) {
			console.error(
				`apiService: [_handlePointerLookup] Error from bitcoinService for ${pointer}:`,
				result.error,
			);
			resp.writeHead(result.statusCode, { "Content-Type": "text/plain" });
			const errorMessage =
				result.error instanceof Error
					? result.error.message
					: String(result.error);
			resp.end(`Error: ${errorMessage}`);
			return;
		}

		console.log(
			`apiService: [_handlePointerLookup] Successfully got data from bitcoinService for ${pointer}`,
		);
		resp.writeHead(200, result.headers);
		resp.end(result.file.data);
	} catch (serviceCallError) {
		// Catch errors specifically from the service call itself or response writing
		console.error(
			`apiService: [_handlePointerLookup] Critical error during service call/response for ${pointer}:`,
			serviceCallError,
		);
		// Avoid writing headers again if they were already partially sent
		if (!resp.headersSent) {
			resp.writeHead(500, { "Content-Type": "text/plain" });
			resp.end("Internal Server Error during service call");
		}
	}
}

// --- API Endpoints ---

// Serves the main index.html page using EJS
export const getRoot = api.raw(
    { expose: true, method: "GET", path: "/" },
    async (_req: IncomingMessage, resp: ServerResponse) => {
        try {
            // Construct the full URL to parse query parameters
            const host = _req.headers.host || "http://localhost";
            // Ensure the base URL has a scheme.
            const base = host.startsWith("http") ? host : `http://${host}`;
            const fullUrl = new URL(_req.url || "", base);
            const queryParams = fullUrl.searchParams;
            const rawParam = queryParams.get("raw"); // Get the 'raw' query parameter

            if (ORDFS_DOMAINS && fullUrl.hostname !== ORDFS_HOST) {
                const outpoint = await loadPointerFromDNS(fullUrl.hostname);
                const file = await loadInscription(outpoint);
                
                // Use the parsed rawParam here
                if (file.type === "ord-fs/json" && rawParam === null) { // Check if rawParam is not present
                    resp.writeHead(302, {Location: `index.html`})
                    resp.end();
                    return;
                }
                return sendFile(file, resp, false);
            }

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

// Renders HTML provided as base64 in the path parameter
export const getPreview = api.raw(
	{ expose: true, method: "GET", path: "/preview/:b64HtmlData" },
	async (req: IncomingMessage, resp: ServerResponse) => {
		try {
			if (!req.url) {
				throw new Error("Request URL is missing");
			}
			// Extract base64 data from path: /preview/<base64data>
			const prefix = "/preview/";
			let b64HtmlData = "";
			if (req.url.startsWith(prefix)) {
				b64HtmlData = req.url.substring(prefix.length);
			} else {
				throw new Error("Invalid preview URL format");
			}
			// Remove potential query parameters
			const queryIndex = b64HtmlData.indexOf("?");
			if (queryIndex !== -1) {
				b64HtmlData = b64HtmlData.substring(0, queryIndex);
			}

			// Decode Base64
			const htmlData = Buffer.from(b64HtmlData, "base64").toString("utf8");

			// Render the preview template
			const viewPath = join(process.cwd(), "views", "pages", "preview.ejs");
			const templateData = { htmlData }; // Pass decoded HTML to template
			const ejsOptions: ejs.Options = {
				root: join(process.cwd(), "views"), // For potential includes in preview.ejs
			};

			const html = await ejs.renderFile(viewPath, templateData, ejsOptions);

			resp.writeHead(200, { "Content-Type": "text/html" });
			resp.end(html);
		} catch (error) {
			console.error("Error rendering preview:", error);
			resp.writeHead(400, { "Content-Type": "text/plain" }); // Use 400 for bad input/decode errors
			resp.end(`Error rendering preview: ${(error as Error).message}`);
		}
	},
);

// Handles /content/:pointer requests specifically for TXID/Outpoints
export const getContentPointer = api.raw(
	{ expose: true, method: "GET", path: "/content/:pointer" },
	async (req: IncomingMessage, resp: ServerResponse) => {
		let ptr = ""; // pointer
		try {
			if (!req.url) {
				throw new Error("Request URL is missing");
			}
			const prefix = "/content/";
			if (req.url.startsWith(prefix)) {
				ptr = req.url.substring(prefix.length);
			} else {
				throw new Error("Invalid /content/ URL format");
			}
			const queryIndex = ptr.indexOf("?");
			if (queryIndex !== -1) {
				ptr = ptr.substring(0, queryIndex);
			}
			console.log(`apiService: Received request for /content/ pointer: ${ptr}`);

			if (!txidRegex.test(ptr)) {
				console.warn(
					`apiService: Invalid format for /content/ pointer: ${ptr}`,
				);
				resp.writeHead(400, { "Content-Type": "text/plain" });
				resp.end(
					"Bad Request: Invalid TXID/Outpoint format for /content/ path",
				);
				return;
			}

			// Call the shared handler
			await _handlePointerLookup(ptr, resp);
		} catch (error) {
			// Catch errors from URL parsing or format validation before calling the handler
			console.error(
				`apiService: Error in getContentPointer wrapper for ${ptr}:`,
				error,
			);
			if (!resp.headersSent) {
				resp.writeHead(500, { "Content-Type": "text/plain" });
				resp.end(`Internal Server Error: ${(error as Error).message}`);
			}
		}
	},
);

// Handles /:fileOrPointer for inscriptions, outpoints, or DNS names
export const getFileOrPointer = api.raw(
	{ expose: true, method: "GET", path: "/:fileOrPointer" },
	async (req: IncomingMessage, resp: ServerResponse) => {
		let fop = ""; // fileOrPointer
		let finalPointer = "";
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
						finalPointer = Array.isArray(dnsPointer)
							? dnsPointer[0]
							: dnsPointer;
						console.log(
							`apiService: DNS lookup for ${fop} resolved to: ${finalPointer}`,
						);
						if (!txidRegex.test(finalPointer)) {
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

			// Call the shared handler
			await _handlePointerLookup(finalPointer, resp);
		} catch (error) {
			// Catch errors from URL parsing, format validation, or DNS resolution before calling the handler
			console.error(
				`apiService: Error in getFileOrPointer wrapper for ${fop}:`,
				error,
			);
			if (!resp.headersSent) {
				resp.writeHead(500, { "Content-Type": "text/plain" });
				resp.end(`Internal Server Error: ${(error as Error).message}`);
			}
		}
	},
);
