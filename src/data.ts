import { OpCode, type Script, Tx } from "@ts-bitcoin/core";
import { Redis } from "ioredis";
import type { File } from "./models/models.js";
import type { Outpoint } from "./models/outpoint.js";
import { type ITxProvider, ProxyProvider, RpcProvider } from "./provider.js";

let bsvProvider: ITxProvider = new ProxyProvider();

if (process.env.BITCOIN_HOST) {
	bsvProvider = new RpcProvider(
		process.env.BITCOIN_HOST || "",
		process.env.BITCOIN_PORT || "8332",
		process.env.BITCOIN_USER || "",
		process.env.BITCOIN_PASS || "",
	);
}

const B = Buffer.from("19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut");
const ORD = Buffer.from("ord");

let redis: Redis;
if (process.env.REDIS_HOST) {
	const host = process.env.REDIS_HOST;
	const port = process.env.REDIS_PORT
		? Number.parseInt(process.env.REDIS_PORT, 10)
		: 6379;
	console.log("Connecting to redis:", host, port);
	redis = new Redis(port, host);
}
export { redis };

export async function getRawTx(txid: string): Promise<Buffer> {
	let rawtx = await redis?.getBuffer(txid);
	if (!rawtx) {
		try {
			rawtx = await bsvProvider.getRawTx(txid);
		} catch (e) {
			console.warn(
				`bsvProvider.getRawTx failed for ${txid}: ${(e as Error).message}`,
			);
		}
	}
	if (!rawtx) {
		throw new Error(`Transaction ${txid} not found by BSV provider`);
	}
	return rawtx;
}

export async function loadTx(txid: string): Promise<Tx> {
	return Tx.fromBuffer(await getRawTx(txid));
}

export async function getBlockchainInfo(): Promise<{
	height: number;
	hash: string;
}> {
	return bsvProvider.getBlockchainInfo();
}

export async function getBlockByHeight(
	height: number,
): Promise<{ height: number; hash: string }> {
	return bsvProvider.getBlockByHeight(height);
}

export async function getBlockByHash(
	hash: string,
): Promise<{ height: number; hash: string }> {
	return bsvProvider.getBlockByHash(hash);
}

export async function loadFileByOutpoint(
	outpoint: Outpoint,
	fuzzy = false,
): Promise<File> {
	const url = `https://ordinals.gorillapool.io/content/${outpoint.toString()}${
		fuzzy ? "?fuzzy=true" : ""
	}`;
	const resp = await fetch(url);
	if (!resp.ok) {
		throw new Error(
			`loadFileByOutpoint fetch failed for ${outpoint}: ${resp.status} ${resp.statusText}`,
		);
	}
	return {
		data: Buffer.from(await resp.arrayBuffer()),
		type: resp.headers.get("content-type") || "",
	};
}

export async function loadFileByInpoint(inpoint: string): Promise<File> {
	const [txid, vout] = inpoint.split("i");
	const rawtx = await getRawTx(txid);
	const tx = Tx.fromBuffer(rawtx);
	return parseScript(tx.txIns[Number.parseInt(vout, 10)].script);
}

export async function loadFileByTxid(txid: string): Promise<File> {
	const tx = await loadTx(txid);
	for (const txOut of tx.txOuts) {
		try {
			const data = parseScript(txOut.script);
			if (data) return data;
		} catch (e) {
			console.warn(
				`parseScript failed for output in ${txid}: ${(e as Error).message}`,
			);
		}
	}
	throw new Error(`Inscription not found in any output for tx ${txid}`);
}

export function parseScript(script: Script): File {
	let opFalse = 0;
	let opIf = 0;
	for (const [i, chunk] of script.chunks.entries()) {
		if (chunk.opCodeNum === OpCode.OP_FALSE) {
			opFalse = i;
		}
		if (chunk.opCodeNum === OpCode.OP_IF) {
			opIf = i;
		}
		if (chunk.buf?.equals(ORD) && opFalse === i - 2 && opIf === i - 1) {
			const file = {} as File;
			for (let j = i + 1; j < script.chunks.length; j += 2) {
				if (script.chunks[j].buf) break;
				switch (script.chunks[j].opCodeNum) {
					case OpCode.OP_0:
						file.data = script.chunks[j + 1].buf;
						return file;
					case OpCode.OP_1:
						file.type = script.chunks[j + 1].buf?.toString("utf8");
						break;
					case OpCode.OP_ENDIF:
						break;
				}
			}
		}
		if (chunk.buf?.equals(B)) {
			return {
				data: script.chunks[i + 1].buf,
				type: script.chunks[i + 2].buf?.toString("utf8"),
			};
		}
	}
	throw new Error("Inscription pattern not found in script");
}
