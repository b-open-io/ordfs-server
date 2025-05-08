import * as dns from "node:dns/promises";
import fetch from "cross-fetch";
import createError, { BadRequest, NotFound } from "http-errors";

import {
	getBlockByHeight,
	loadFileByInpoint,
	loadFileByOutpoint,
	loadFileByTxid,
} from "./data";
import { File } from "./models/models";
import { Outpoint } from "./models/outpoint";

export async function loadPointerFromDNS(hostname: string): Promise<string> {
	const lookupDomain = `_ordfs.${hostname}`;
	const TXTs = await dns.resolveTxt(lookupDomain);
	const prefix = "ordfs=";
	let pointer = "";
	console.log("Lookup Up:", lookupDomain);
	for (const TXT of TXTs) {
		for (const elem of TXT) {
			if (!elem.startsWith(prefix)) continue;
			console.log("Elem:", elem);
			pointer = elem.slice(prefix.length);
			console.log("Origin:", pointer);
			return pointer;
		}
	}
	throw new NotFound();
}

export async function loadInscription(
	pointer: string,
	metadata = false,
	fuzzy = false,
): Promise<File> {
	console.log("loadInscription", pointer, { metadata, fuzzy });
	let file: File | undefined;

	if (pointer.match(/^[0-9a-fA-F]{64}$/)) {
		console.log(
			`Raw TXID detected: ${pointer}. Attempting TXID_0 with fuzzy=${fuzzy}`,
		);
		try {
			const outpointStr = `${pointer}_0`;
			console.log(
				`Calling loadFileByOutpoint for ${outpointStr} with fuzzy=${fuzzy}`,
			);
			file = await loadFileByOutpoint(Outpoint.fromString(outpointStr), fuzzy);
			console.log(
				`loadFileByOutpoint succeeded for ${outpointStr}. File type: ${file?.type}, Data length: ${file?.data?.length}`,
			);
		} catch (err) {
			console.warn(
				`loadFileByOutpoint for ${pointer}_0 failed with fuzzy=${fuzzy}. Error: ${(err as Error).message}. Falling back to loadFileByTxid.`,
			);
			try {
				console.log(`Calling fallback loadFileByTxid for ${pointer}`);
				file = await loadFileByTxid(pointer);
				console.log(
					`Fallback loadFileByTxid succeeded for ${pointer}. File type: ${file?.type}, Data length: ${file?.data?.length}`,
				);
			} catch (finalErr) {
				console.error(
					`Fallback loadFileByTxid for ${pointer} also failed. Error: ${(finalErr as Error).message}`,
				);
				throw finalErr;
			}
		}
	} else if (pointer.match(/^[0-9a-fA-F]{64}i\d+$/)) {
		file = await loadFileByInpoint(pointer);
	} else if (pointer.match(/^[0-9a-fA-F]{64}_\d+$/)) {
		console.log(
			`Outpoint detected: ${pointer}. Calling loadFileByOutpoint with fuzzy=${fuzzy}`,
		);
		file = await loadFileByOutpoint(Outpoint.fromString(pointer), fuzzy);
		console.log(
			`loadFileByOutpoint succeeded for outpoint ${pointer}. File type: ${file?.type}, Data length: ${file?.data?.length}`,
		);
		if (file && metadata) {
			try {
				const url = `https://ordinals.gorillapool.io/api/txos/${pointer}`;
				const resp = await fetch(url);
				if (!resp.ok) {
					throw createError(resp.status, resp.statusText);
				}
				const data = await resp.json();
				const { hash } = await getBlockByHeight("bsv", data.height);

				file.meta = {
					...data,
					hash,
				};
			} catch (e) {
				console.warn(`Metadata fetch failed: ${(e as Error).message}`);
			}
		}
	} else throw new BadRequest("Invalid Pointer");

	if (!file) {
		console.error(`No file found for pointer ${pointer} after all attempts.`);
		throw new NotFound();
	}
	console.log(`Returning file for pointer ${pointer}. Type: ${file.type}`);
	return file;
}
export { File };
