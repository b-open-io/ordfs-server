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
const cors_1 = __importDefault(require("cors"));
const dotenv = __importStar(require("dotenv"));
const express_1 = __importDefault(require("express"));
const http_errors_1 = require("http-errors");
const routes_1 = require("./routes");
dotenv.config();
const server = (0, express_1.default)();
async function main() {
	const PORT = process.env.PORT || 8080;
	server.listen(PORT, () => {
		console.log(`Server listening on port ${PORT}`);
	});
}
server.set("trust proxy", true);
server.use((0, cors_1.default)({ origin: true }));
server.set("view engine", "ejs");
server.use("/public", express_1.default.static("public"));
server.use((req, _res, next) => {
	console.log(req.path, req.method);
	next();
});
(0, routes_1.RegisterRoutes)(server);
server.use((req, _res, next) => {
	console.log(req.path);
	next(new http_errors_1.NotFound("Not Found"));
});
const errorMiddleware = (err, req, res) => {
	console.error(req.path, err.status || 500, err.message);
	res.status(err.status || 500).json({ message: err.message });
};
server.use(errorMiddleware);
main().catch(console.error);
//# sourceMappingURL=server.js.map
