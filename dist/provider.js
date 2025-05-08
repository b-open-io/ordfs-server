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
var __importDefault =
	(this && this.__importDefault) ||
	function (mod) {
		return mod && mod.__esModule ? mod : { default: mod };
	};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BtcProvider = exports.ProxyProvider = exports.RpcProvider = void 0;
const bitcoin_core_1 = __importDefault(require("bitcoin-core"));
require("cross-fetch/polyfill");
const http_errors_1 = __importStar(require("http-errors"));
const ioredis_1 = require("ioredis");
let redis;
if (process.env.REDIS_HOST) {
	const host = process.env.REDIS_HOST;
	const port = process.env.REDIS_PORT
		? Number.parseInt(process.env.REDIS_PORT, 10)
		: 6379;
	console.log("Connecting to redis:", host, port);
	redis = new ioredis_1.Redis(port, host);
}
class RpcProvider {
	constructor(network, host, port, username, password) {
		this.network = network;
		this.client = new bitcoin_core_1.default({
			host: `${host}:${port}`,
			username,
			password,
		});
	}
	async getRawTx(txid) {
		let rawtx = await (redis === null || redis === void 0
			? void 0
			: redis.getBuffer(txid));
		if (!rawtx) {
			rawtx = await this.client.getTransactionByHash(txid, {
				extension: "bin",
			});
			if (!rawtx) {
				throw new http_errors_1.NotFound();
			}
			redis === null || redis === void 0 ? void 0 : redis.set(txid, rawtx);
		}
		return rawtx;
	}
	async getBlockchainInfo() {
		const info = await this.client.getBlockchainInformation();
		return {
			height: info.blocks,
			hash: info.bestblockhash,
		};
	}
	async getBlockByHeight(height) {
		const hash = await this.client.command({
			method: "getblockhash",
			parameters: [height],
		});
		return { height, hash };
	}
	async getBlockByHash(hash) {
		const info = await this.client.command({
			method: "getblockheader",
			parameters: [hash, true],
		});
		return {
			height: info.height,
			hash,
		};
	}
}
exports.RpcProvider = RpcProvider;
class ProxyProvider {
	constructor() {
		this.network = "bsv";
	}
	async getRawTx(txid) {
		let rawtx = await (redis === null || redis === void 0
			? void 0
			: redis.getBuffer(txid));
		if (!rawtx) {
			const resp = await fetch(
				`https://junglebus.gorillapool.io/v1/transaction/get/${txid}/bin`,
			);
			if (!resp.ok) {
				throw (0, http_errors_1.default)(resp.status, resp.statusText);
			}
			rawtx = Buffer.from(await resp.arrayBuffer());
			redis === null || redis === void 0 ? void 0 : redis.set(txid, rawtx);
		}
		return rawtx;
	}
	async getBlockchainInfo() {
		const resp = await fetch(
			"https://api.whatsonchain.com/v1/bsv/main/block/headers",
		);
		if (!resp.ok) {
			throw (0, http_errors_1.default)(resp.status, resp.statusText);
		}
		const info = await resp.json();
		return {
			height: info[0].height,
			hash: info[0].hash,
		};
	}
	async getBlockByHeight(height) {
		const resp = await fetch(
			`https://api.whatsonchain.com/v1/bsv/main/block/height/${height}`,
		);
		const info = await resp.json();
		return { height, hash: info.hash };
	}
	async getBlockByHash(hash) {
		const resp = await fetch(
			`https://api.whatsonchain.com/v1/bsv/main/block/hash/${hash}`,
		);
		const info = await resp.json();
		return {
			height: info.height,
			hash,
		};
	}
}
exports.ProxyProvider = ProxyProvider;
class BtcProvider {
	constructor() {
		this.network = "btc";
	}
	async getRawTx(txid) {
		let rawtx = await (redis === null || redis === void 0
			? void 0
			: redis.getBuffer(txid));
		if (!rawtx) {
			// TODO: Make this configuration based
			const resp = await fetch(
				`https://ordfs.gorillapool.io/v1/btc/tx/${txid}`,
			);
			if (!resp.ok) {
				throw (0, http_errors_1.default)(resp.status, resp.statusText);
			}
			rawtx = Buffer.from(await resp.arrayBuffer());
			redis === null || redis === void 0 ? void 0 : redis.set(txid, rawtx);
		}
		return rawtx;
	}
	async getBlockchainInfo() {
		// TODO: Make this configuration based
		const resp = await fetch(
			"https://ordfs.gorillapool.io/v1/btc/block/latest",
		);
		if (!resp.ok) {
			throw (0, http_errors_1.default)(resp.status, resp.statusText);
		}
		return resp.json();
	}
	async getBlockByHeight(height) {
		const resp = await fetch(
			`https://ordfs.gorillapool.io/v1/btc/block/height/${height}`,
		);
		const info = await resp.json();
		return { height, hash: info.hash };
	}
	async getBlockByHash(hash) {
		const resp = await fetch(
			`https://ordfs.gorillapool.io/v1/btc/block/hash/${hash}`,
		);
		const info = await resp.json();
		return {
			height: info.height,
			hash,
		};
	}
}
exports.BtcProvider = BtcProvider;
//# sourceMappingURL=provider.js.map
