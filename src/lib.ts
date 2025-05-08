import * as dns from "node:dns/promises";
import fetch from "cross-fetch";

import {
	getBlockByHeight,
	loadFileByInpoint,
	loadFileByOutpoint,
	loadFileByTxid,
	redis,
} from "./data.js";
import { type File } from "./models/models.js";
import { Outpoint } from "./models/outpoint.js";

const CACHE_TTL_SECONDS = 60 * 60 * 24; // 24 hours

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
	throw new Error("ordfs= TXT record not found in DNS");
}

export async function loadInscription(
	pointer: string,
	metadata = false,
	fuzzy = false,
): Promise<File> {
	console.log("loadInscription", pointer, { metadata, fuzzy });

	const cacheKeyBase = `inscription:${pointer}`;
	const cacheKeyType = `${cacheKeyBase}:type`;
	const cacheKeyData = `${cacheKeyBase}:data`;

	if (redis) {
		try {
			const execResult = await redis
				.multi()
				.get(cacheKeyType)
				.getBuffer(cacheKeyData)
				.exec();

			// exec() returns an array of [error, result] tuples
			const typeResult = execResult?.[0];
			const dataResult = execResult?.[1];

			const actualCachedType =
				typeResult && !typeResult[0] ? (typeResult[1] as string | null) : null;
			const actualCachedData =
				dataResult && !dataResult[0] ? (dataResult[1] as Buffer | null) : null;

			if (actualCachedType && actualCachedData) {
				console.log(`Cache HIT for pointer: ${pointer}`);
				const file: File = { type: actualCachedType, data: actualCachedData };
				if (metadata && pointer.match(/^[0-9a-fA-F]{64}_\d+$/) && file) {
					try {
						const url = `https://ordinals.gorillapool.io/api/txos/${pointer}`;
						const resp = await fetch(url);
						if (!resp.ok) {
							throw new Error(
								`Metadata fetch failed for cached entry ${pointer}: ${resp.status} ${resp.statusText}`,
							);
						}
						const metaJson = await resp.json();
						const { hash } = await getBlockByHeight("bsv", metaJson.height);
						file.meta = { ...metaJson, hash };
					} catch (e) {
						console.warn(
							`Metadata fetch warning for cached entry ${pointer}: ${(e as Error).message}`,
						);
					}
				}
				return file;
			}
			console.log(`Cache MISS for pointer: ${pointer}`);
		} catch (err) {
			console.error(
				`Redis error during cache read for ${pointer}: ${(err as Error).message}`,
			);
		}
	}

	let file: File | undefined;
	let effectivePointer = pointer;

	if (pointer.match(/^[0-9a-fA-F]{64}$/)) {
		console.log(
			`Raw TXID detected: ${pointer}. Attempting TXID_0 with fuzzy=${fuzzy}`,
		);
		effectivePointer = `${pointer}_0`;
		try {
			console.log(
				`Calling loadFileByOutpoint for ${effectivePointer} with fuzzy=${fuzzy}`,
			);
			file = await loadFileByOutpoint(
				Outpoint.fromString(effectivePointer),
				fuzzy,
			);
			console.log(
				`loadFileByOutpoint succeeded for ${effectivePointer}. File type: ${file?.type}, Data length: ${file?.data?.length}`,
			);
		} catch (err) {
			console.warn(
				`loadFileByOutpoint for ${effectivePointer} failed with fuzzy=${fuzzy}. Error: ${(err as Error).message}. Falling back to loadFileByTxid.`,
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
	} else throw new Error("Invalid Pointer");

	if (!file) {
		console.error(`No file found for pointer ${pointer} after all attempts.`);
		throw new Error("Inscription Not Found");
	}

	if (metadata && effectivePointer.match(/^[0-9a-fA-F]{64}_\d+$/) && file) {
		try {
			const url = `https://ordinals.gorillapool.io/api/txos/${effectivePointer}`;
			const resp = await fetch(url);
			if (!resp.ok) {
				throw new Error(
					`Metadata fetch failed for ${effectivePointer}: ${resp.status} ${resp.statusText}`,
				);
			}
			const data = await resp.json();
			const { hash } = await getBlockByHeight("bsv", data.height);

			file.meta = {
				...data,
				hash,
			};
		} catch (e) {
			console.warn(
				`Metadata fetch warning for ${effectivePointer}: ${(e as Error).message}`,
			);
		}
	}

	if (redis && file.data && file.type) {
		try {
			await redis
				.multi()
				.set(cacheKeyType, file.type, "EX", CACHE_TTL_SECONDS)
				.set(cacheKeyData, file.data, "EX", CACHE_TTL_SECONDS)
				.exec();
			console.log(`Stored in cache: ${pointer}`);
		} catch (err) {
			console.error(
				`Redis error during cache write for ${pointer}: ${(err as Error).message}`,
			);
		}
	}

	console.log(`Returning file for pointer ${pointer}. Type: ${file.type}`);
	return file;
}
