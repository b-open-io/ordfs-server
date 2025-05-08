"use strict";
var __createBinding =
	(this && this.__createBinding) ||
	(Object.create
		? function (o, m, k, k2) {
				if (k2 === undefined) k2 = k;
				var desc = Object.getOwnPropertyDescriptor(m, k);
				if (
					!desc ||
					("get" in desc ? !m.__esModule : desc.writable || desc.configurable)
				) {
					desc = {
						enumerable: true,
						get: function () {
							return m[k];
						},
					};
				}
				Object.defineProperty(o, k2, desc);
			}
		: function (o, m, k, k2) {
				if (k2 === undefined) k2 = k;
				o[k2] = m[k];
			});
var __setModuleDefault =
	(this && this.__setModuleDefault) ||
	(Object.create
		? function (o, v) {
				Object.defineProperty(o, "default", { enumerable: true, value: v });
			}
		: function (o, v) {
				o["default"] = v;
			});
var __importStar =
	(this && this.__importStar) ||
	(function () {
		var ownKeys = function (o) {
			ownKeys =
				Object.getOwnPropertyNames ||
				function (o) {
					var ar = [];
					for (var k in o)
						if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
					return ar;
				};
			return ownKeys(o);
		};
		return function (mod) {
			if (mod && mod.__esModule) return mod;
			var result = {};
			if (mod != null)
				for (var k = ownKeys(mod), i = 0; i < k.length; i++)
					if (k[i] !== "default") __createBinding(result, mod, k[i]);
			__setModuleDefault(result, mod);
			return result;
		};
	})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRawTx = getRawTx;
exports.loadTx = loadTx;
exports.getBlockchainInfo = getBlockchainInfo;
exports.getBlockByHeight = getBlockByHeight;
exports.getBlockByHash = getBlockByHash;
exports.loadFileByOutpoint = loadFileByOutpoint;
exports.loadFileByInpoint = loadFileByInpoint;
exports.loadFileByTxid = loadFileByTxid;
exports.parseScript = parseScript;
const core_1 = require("@ts-bitcoin/core");
const bitcore_lib_1 = require("bitcore-lib");
const http_errors_1 = __importStar(require("http-errors"));
const ioredis_1 = require("ioredis");
const provider_1 = require("./provider");
let bsvProvider = new provider_1.ProxyProvider();
let btcProvider = new provider_1.BtcProvider();
if (process.env.BITCOIN_HOST) {
	bsvProvider = new provider_1.RpcProvider(
		"bsv",
		process.env.BITCOIN_HOST || "",
		process.env.BITCOIN_PORT || "8332",
		process.env.BITCOIN_USER || "",
		process.env.BITCOIN_PASS || "",
	);
}
if (process.env.BTC_HOST) {
	btcProvider = new provider_1.RpcProvider(
		"btc",
		process.env.BTC_HOST || "",
		process.env.BTC_PORT || "8332",
		process.env.BTC_USER || "",
		process.env.BTC_PASS || "",
	);
}
const B = Buffer.from("19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut");
const ORD = Buffer.from("ord");
let redis;
if (process.env.REDIS_HOST) {
	const host = process.env.REDIS_HOST;
	const port = process.env.REDIS_PORT
		? Number.parseInt(process.env.REDIS_PORT, 10)
		: 6379;
	console.log("Connecting to redis:", host, port);
	redis = new ioredis_1.Redis(port, host);
}
async function getRawTx(txid) {
	let rawtx = await (redis === null || redis === void 0
		? void 0
		: redis.getBuffer(txid));
	if (!rawtx) {
		try {
			rawtx = await bsvProvider.getRawTx(txid);
		} catch (e) {
			console.warn(`bsvProvider.getRawTx failed for ${txid}: ${e.message}`);
		}
		// const url = `http://${BITCOIN_HOST}:${BITCOIN_PORT}/rest/tx/${txid}.bin`
		// const resp = await fetch(url);
		// if (!resp.ok) {
		//     throw createError(resp.status, resp.statusText)
		// }
		// rawtx = Buffer.from(await resp.arrayBuffer());
	}
	if (!rawtx) {
		try {
			rawtx = await btcProvider.getRawTx(txid);
		} catch (e) {
			console.warn(`btcProvider.getRawTx failed for ${txid}: ${e.message}`);
		}
	}
	if (!rawtx) {
		throw new http_errors_1.NotFound();
	}
	return rawtx;
}
async function loadTx(txid) {
	return core_1.Tx.fromBuffer(await getRawTx(txid));
}
async function getBlockchainInfo(network) {
	switch (network) {
		case "bsv":
			return bsvProvider.getBlockchainInfo();
		case "btc":
			return btcProvider.getBlockchainInfo();
	}
	throw new Error("Invalid Network");
}
async function getBlockByHeight(network, height) {
	switch (network) {
		case "bsv":
			return bsvProvider.getBlockByHeight(height);
		case "btc":
			return btcProvider.getBlockByHeight(height);
	}
	throw new Error("Invalid Network");
}
async function getBlockByHash(network, hash) {
	switch (network) {
		case "bsv":
			return bsvProvider.getBlockByHash(hash);
		case "btc":
			return btcProvider.getBlockByHash(hash);
	}
	throw new Error("Invalid Network");
}
async function loadFileByOutpoint(outpoint, fuzzy = false) {
	const url = `https://ordinals.gorillapool.io/content/${outpoint.toString()}${fuzzy ? "?fuzzy=true" : ""}`;
	const resp = await fetch(url);
	if (!resp.ok) {
		throw (0, http_errors_1.default)(resp.status, resp.statusText);
	}
	return {
		data: Buffer.from(await resp.arrayBuffer()),
		type: resp.headers.get("content-type") || "",
	};
}
async function loadFileByInpoint(inpoint) {
	const [txid, vout] = inpoint.split("i");
	const rawtx = await getRawTx(txid);
	const tx = new bitcore_lib_1.Transaction(rawtx);
	return parseScript(tx.txIns[Number.parseInt(vout, 10)].script);
}
async function loadFileByTxid(txid) {
	const tx = await loadTx(txid);
	for (const txOut of tx.txOuts) {
		try {
			const data = parseScript(txOut.script);
			if (data) return data;
		} catch (e) {
			console.warn(`parseScript failed for output in ${txid}: ${e.message}`);
		}
	}
	throw new http_errors_1.NotFound();
}
function parseScript(script) {
	var _a, _b, _c, _d;
	let opFalse = 0;
	let opIf = 0;
	for (const [i, chunk] of script.chunks.entries()) {
		if (chunk.opCodeNum === core_1.OpCode.OP_FALSE) {
			opFalse = i;
		}
		if (chunk.opCodeNum === core_1.OpCode.OP_IF) {
			opIf = i;
		}
		if (
			((_a = chunk.buf) === null || _a === void 0 ? void 0 : _a.equals(ORD)) &&
			opFalse === i - 2 &&
			opIf === i - 1
		) {
			const file = {};
			for (let j = i + 1; j < script.chunks.length; j += 2) {
				if (script.chunks[j].buf) break;
				switch (script.chunks[j].opCodeNum) {
					case core_1.OpCode.OP_0:
						file.data = script.chunks[j + 1].buf;
						return file;
					case core_1.OpCode.OP_1:
						file.type =
							(_b = script.chunks[j + 1].buf) === null || _b === void 0
								? void 0
								: _b.toString("utf8");
						break;
					case core_1.OpCode.OP_ENDIF:
						break;
				}
			}
		}
		if ((_c = chunk.buf) === null || _c === void 0 ? void 0 : _c.equals(B)) {
			return {
				data: script.chunks[i + 1].buf,
				type:
					(_d = script.chunks[i + 2].buf) === null || _d === void 0
						? void 0
						: _d.toString("utf8"),
			};
		}
	}
	throw new http_errors_1.NotFound();
}
//# sourceMappingURL=data.js.map
