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
exports.loadPointerFromDNS = loadPointerFromDNS;
exports.loadInscription = loadInscription;
const dns = __importStar(require("node:dns/promises"));
const cross_fetch_1 = __importDefault(require("cross-fetch"));
const http_errors_1 = __importStar(require("http-errors"));
const data_1 = require("./data");
const outpoint_1 = require("./models/outpoint");
async function loadPointerFromDNS(hostname) {
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
	throw new http_errors_1.NotFound();
}
async function loadInscription(pointer, metadata = false, fuzzy = false) {
	var _a, _b, _c;
	console.log("loadInscription", pointer, { metadata, fuzzy });
	let file;
	if (pointer.match(/^[0-9a-fA-F]{64}$/)) {
		console.log(
			`Raw TXID detected: ${pointer}. Attempting TXID_0 with fuzzy=${fuzzy}`,
		);
		try {
			const outpointStr = `${pointer}_0`;
			console.log(
				`Calling loadFileByOutpoint for ${outpointStr} with fuzzy=${fuzzy}`,
			);
			file = await (0, data_1.loadFileByOutpoint)(
				outpoint_1.Outpoint.fromString(outpointStr),
				fuzzy,
			);
			console.log(
				`loadFileByOutpoint succeeded for ${outpointStr}. File type: ${file === null || file === void 0 ? void 0 : file.type}, Data length: ${(_a = file === null || file === void 0 ? void 0 : file.data) === null || _a === void 0 ? void 0 : _a.length}`,
			);
		} catch (err) {
			console.warn(
				`loadFileByOutpoint for ${pointer}_0 failed with fuzzy=${fuzzy}. Error: ${err.message}. Falling back to loadFileByTxid.`,
			);
			try {
				console.log(`Calling fallback loadFileByTxid for ${pointer}`);
				file = await (0, data_1.loadFileByTxid)(pointer);
				console.log(
					`Fallback loadFileByTxid succeeded for ${pointer}. File type: ${file === null || file === void 0 ? void 0 : file.type}, Data length: ${(_b = file === null || file === void 0 ? void 0 : file.data) === null || _b === void 0 ? void 0 : _b.length}`,
				);
			} catch (finalErr) {
				console.error(
					`Fallback loadFileByTxid for ${pointer} also failed. Error: ${finalErr.message}`,
				);
				throw finalErr;
			}
		}
	} else if (pointer.match(/^[0-9a-fA-F]{64}i\d+$/)) {
		file = await (0, data_1.loadFileByInpoint)(pointer);
	} else if (pointer.match(/^[0-9a-fA-F]{64}_\d+$/)) {
		console.log(
			`Outpoint detected: ${pointer}. Calling loadFileByOutpoint with fuzzy=${fuzzy}`,
		);
		file = await (0, data_1.loadFileByOutpoint)(
			outpoint_1.Outpoint.fromString(pointer),
			fuzzy,
		);
		console.log(
			`loadFileByOutpoint succeeded for outpoint ${pointer}. File type: ${file === null || file === void 0 ? void 0 : file.type}, Data length: ${(_c = file === null || file === void 0 ? void 0 : file.data) === null || _c === void 0 ? void 0 : _c.length}`,
		);
		if (file && metadata) {
			try {
				const url = `https://ordinals.gorillapool.io/api/txos/${pointer}`;
				const resp = await (0, cross_fetch_1.default)(url);
				if (!resp.ok) {
					throw (0, http_errors_1.default)(resp.status, resp.statusText);
				}
				const data = await resp.json();
				const { hash } = await (0, data_1.getBlockByHeight)("bsv", data.height);
				file.meta = Object.assign(Object.assign({}, data), { hash });
			} catch (e) {
				console.warn(`Metadata fetch failed: ${e.message}`);
			}
		}
	} else throw new http_errors_1.BadRequest("Invalid Pointer");
	if (!file) {
		console.error(`No file found for pointer ${pointer} after all attempts.`);
		throw new http_errors_1.NotFound();
	}
	console.log(`Returning file for pointer ${pointer}. Type: ${file.type}`);
	return file;
}
//# sourceMappingURL=lib.js.map
