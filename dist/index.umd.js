!(function (e, t) {
	"object" == typeof exports && "undefined" != typeof module
		? t(
				exports,
				require("http-errors"),
				require("@ts-bitcoin/core"),
				require("dns/promises"),
				require("cross-fetch"),
				require("@gorillapool/js-junglebus"),
				require("ioredis"),
			)
		: "function" == typeof define && define.amd
			? define(
					[
						"exports",
						"http-errors",
						"@ts-bitcoin/core",
						"dns/promises",
						"cross-fetch",
						"@gorillapool/js-junglebus",
						"ioredis",
					],
					t,
				)
			: t(
					((e || self).ordfsServer = {}),
					e.httpErrors,
					e.core,
					e.dns,
					e.crossFetch,
					e.jsJunglebus,
					e.ioredis,
				);
})(this, function (e, t, r, n, o, i, u) {
	function s(e) {
		return e && "object" == typeof e && "default" in e ? e : { default: e };
	}
	function a(e) {
		if (e && e.__esModule) return e;
		var t = Object.create(null);
		return (
			e &&
				Object.keys(e).forEach(function (r) {
					if ("default" !== r) {
						var n = Object.getOwnPropertyDescriptor(e, r);
						Object.defineProperty(
							t,
							r,
							n.get
								? n
								: {
										enumerable: !0,
										get: function () {
											return e[r];
										},
									},
						);
					}
				}),
			(t.default = e),
			t
		);
	}
	var c,
		f = /*#__PURE__*/ s(t),
		l = /*#__PURE__*/ a(n),
		h = /*#__PURE__*/ s(o);
	function m(e, t) {
		(null == t || t > e.length) && (t = e.length);
		for (var r = 0, n = new Array(t); r < t; r++) n[r] = e[r];
		return n;
	}
	function v(e, t) {
		var r =
			("undefined" != typeof Symbol && e[Symbol.iterator]) || e["@@iterator"];
		if (r) return (r = r.call(e)).next.bind(r);
		if (
			Array.isArray(e) ||
			(r = (function (e, t) {
				if (e) {
					if ("string" == typeof e) return m(e, t);
					var r = Object.prototype.toString.call(e).slice(8, -1);
					return (
						"Object" === r && e.constructor && (r = e.constructor.name),
						"Map" === r || "Set" === r
							? Array.from(e)
							: "Arguments" === r ||
									/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)
								? m(e, t)
								: void 0
					);
				}
			})(e)) ||
			(t && e && "number" == typeof e.length)
		) {
			r && (e = r);
			var n = 0;
			return function () {
				return n >= e.length ? { done: !0 } : { done: !1, value: e[n++] };
			};
		}
		throw new TypeError(
			"Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.",
		);
	}
	if (process.env.REDIS_HOST) {
		var d = process.env.REDIS_HOST,
			p = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379;
		console.log("Connecting to redis:", d, p), (c = new u.Redis(p, d));
	}
	var g = /*#__PURE__*/ (function () {
			function e() {
				this.network = "bsv";
			}
			var t = e.prototype;
			return (
				(t.getRawTx = function (e) {
					try {
						var t;
						return Promise.resolve(
							null == (t = c) ? void 0 : t.getBuffer("rawtx:" + e),
						).then(function (t) {
							var r = (function () {
								if (!t) {
									var r = new i.JungleBusClient(
										"https://junglebus.gorillapool.io",
									);
									return Promise.resolve(r.GetTransaction(e)).then(
										function (r) {
											var n;
											(t = Buffer.from(r.transaction, "base64")),
												null == (n = c) || n.set("rawtx:" + e, t);
										},
									);
								}
							})();
							return r && r.then
								? r.then(function () {
										return t;
									})
								: t;
						});
					} catch (e) {
						return Promise.reject(e);
					}
				}),
				(t.getBlockchainInfo = function () {
					try {
						return Promise.resolve(
							h.default(
								"https://api.whatsonchain.com/v1/bsv/main/block/headers",
							),
						).then(function (e) {
							if (!e.ok) throw f.default(e.status, e.statusText);
							return Promise.resolve(e.json()).then(function (e) {
								return { height: e[0].height, hash: e[0].hash };
							});
						});
					} catch (e) {
						return Promise.reject(e);
					}
				}),
				(t.getBlockByHeight = function (e) {
					try {
						return Promise.resolve(
							h.default(
								"https://api.whatsonchain.com/v1/bsv/main/block/height/" + e,
							),
						).then(function (t) {
							return Promise.resolve(t.json()).then(function (t) {
								return { height: e, hash: t.hash };
							});
						});
					} catch (e) {
						return Promise.reject(e);
					}
				}),
				(t.getBlockByHash = function (e) {
					try {
						return Promise.resolve(
							h.default(
								"https://api.whatsonchain.com/v1/bsv/main/block/hash/" + e,
							),
						).then(function (t) {
							return Promise.resolve(t.json()).then(function (t) {
								return { height: t.height, hash: e };
							});
						});
					} catch (e) {
						return Promise.reject(e);
					}
				}),
				e
			);
		})(),
		P = function (e, t) {
			void 0 === t && (t = !1);
			try {
				var n,
					o = function (e) {
						if (!n) throw new f.default.NotFound();
						return n;
					};
				console.log("loadInscription", e);
				var i = (function () {
					if (e.match(/^[0-9a-fA-F]{64}_\d*$/)) {
						var o = e.split("_"),
							i = o[0],
							u = o[1];
						return (
							console.log("BSV:", i, u),
							Promise.resolve(N.getRawTx(i)).then(function (o) {
								if (!o) throw new Error("No raw tx found");
								var s = r.Tx.fromBuffer(o),
									a = parseInt(u, 10),
									c = s.txOuts[a].script;
								if (!c) throw new f.default.NotFound();
								n = S(c);
								var l = (function () {
									if (n && t) {
										var r = (function (t, r) {
											try {
												var o = Promise.resolve(
													h.default(
														"https://ordinals.gorillapool.io/api/inscriptions/outpoint/" +
															e,
													),
												).then(function (e) {
													return Promise.resolve(e.json()).then(function (e) {
														return Promise.resolve(
															N.getBlockByHeight(e.height),
														).then(function (t) {
															n.meta = {
																height: e.height,
																MAP: e.MAP,
																hash: t.hash,
																txid: i,
																v: a,
															};
														});
													});
												});
											} catch (e) {
												return;
											}
											return o && o.then ? o.then(void 0, function () {}) : o;
										})();
										if (r && r.then) return r.then(function () {});
									}
								})();
								if (l && l.then) return l.then(function () {});
							})
						);
					}
					throw new Error("Invalid Pointer");
				})();
				return Promise.resolve(i && i.then ? i.then(o) : o());
			} catch (e) {
				return Promise.reject(e);
			}
		},
		y = function (e) {
			try {
				var t = "_ordfs." + e;
				return Promise.resolve(l.resolveTxt(t)).then(function (e) {
					var r = "";
					console.log("Lookup Up:", t);
					e: for (var n, o = v(e); !(n = o()).done; ) {
						for (var i, u = v(n.value); !(i = u()).done; ) {
							var s = i.value;
							if (s.startsWith("ordfs=")) {
								console.log("Elem:", s),
									(r = s.slice(6)),
									console.log("Origin:", r);
								break e;
							}
						}
						if (!r) throw new f.default.NotFound();
					}
					return r;
				});
			} catch (e) {
				return Promise.reject(e);
			}
		},
		w = function (e, t) {
			try {
				if ("bsv" === e) return Promise.resolve(N.getRawTx(t));
				throw new f.default.NotFound("Network Not Found");
			} catch (e) {
				return Promise.reject(e);
			}
		},
		b = function (e, t) {
			try {
				if ("bsv" === e) return Promise.resolve(N.getBlockByHash(t));
				throw new f.default.NotFound("Network Not Found");
			} catch (e) {
				return Promise.reject(e);
			}
		},
		k = function (e, t) {
			try {
				if ("bsv" === e) return Promise.resolve(N.getBlockByHeight(t));
				throw new f.default.NotFound("Network Not Found");
			} catch (e) {
				return Promise.reject(e);
			}
		},
		j = function (e) {
			try {
				if ("bsv" === e) return Promise.resolve(N.getBlockchainInfo());
				throw new f.default.NotFound("Network Not Found");
			} catch (e) {
				return Promise.reject(e);
			}
		},
		O = Buffer.from("19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut"),
		B = Buffer.from("ord"),
		N = new g();
	function S(e) {
		for (
			var t,
				n = 0,
				o = 0,
				i = 0,
				u = "application/octet-stream",
				s = Buffer.alloc(0),
				a = v(e.chunks.entries());
			!(t = a()).done;
		) {
			var c,
				f,
				l = t.value,
				h = l[0],
				m = l[1];
			if (null != (c = m.buf) && c.equals(O) && e.chunks.length > h + 2)
				return {
					data: (s = e.chunks[h + 1].buf),
					type: (u = e.chunks[h + 2].buf.toString()),
				};
			if (
				(m.opCodeNum === r.OpCode.OP_FALSE && (n = h),
				m.opCodeNum === r.OpCode.OP_IF && (o = h),
				null != (f = m.buf) && f.equals(B) && n === h - 2 && o === h - 1)
			) {
				i = h;
				break;
			}
		}
		for (var d = i + 1; d < e.chunks.length; d++)
			switch (e.chunks[d].opCodeNum) {
				case r.OpCode.OP_FALSE:
					for (
						;
						(null == (p = e.chunks[d + 1]) ? void 0 : p.opCodeNum) >= 1 &&
						(null == (g = e.chunks[d + 1]) ? void 0 : g.opCodeNum) <=
							r.OpCode.OP_PUSHDATA4;
					) {
						var p, g;
						(s = Buffer.concat([s, e.chunks[d + 1].buf])), d++;
					}
					break;
				case 1:
					if (1 != e.chunks[d].buf[0]) return;
				case r.OpCode.OP_TRUE:
					(u = e.chunks[d + 1].buf.toString("utf8")), d++;
					break;
				case r.OpCode.OP_ENDIF:
					return { type: u, data: s };
				default:
					return;
			}
		return { type: u, data: s };
	}
	function x(e, t) {
		try {
			var r = e();
		} catch (e) {
			return t(e);
		}
		return r && r.then ? r.then(void 0, t) : r;
	}
	function F(e, t, r) {
		void 0 === r && (r = !0),
			t.header("Content-Type", e.type || ""),
			e.meta && t.header("ordfs-meta", JSON.stringify(e.meta)),
			r &&
				!e.meta &&
				t.header("Cache-Control", "public,immutable,max-age=31536000"),
			t.status(200).send(e.data);
	}
	(e.RegisterRoutes = function (e) {
		var t = function (e, t, r) {
			try {
				return Promise.resolve(
					x(
						function () {
							var r = e.params.pointer,
								n = e.params.filename;
							return Promise.resolve(P(r)).then(function (o) {
								var i = JSON.parse(o.data.toString("utf8"));
								if (!i[n]) throw new f.default.NotFound();
								return (
									(r = i[n].startsWith("ord://") ? i[n].slice(6) : i[n]),
									Promise.resolve(P(r, e.query.meta)).then(function (e) {
										F(e, t, !0);
									})
								);
							});
						},
						function (e) {
							r(e);
						},
					),
				);
			} catch (e) {
				return Promise.reject(e);
			}
		};
		e.get("/", function (e, t) {
			try {
				var r,
					n,
					o = function (o) {
						return r
							? o
							: x(
									function () {
										return Promise.resolve(P(n)).then(function (r) {
											var n;
											"ord-fs/json" !== r.type || e.query.raw
												? F(r, t, !1)
												: null == (n = e.res) || n.redirect("index.html");
										});
									},
									function () {
										t.render("pages/404");
									},
								);
					},
					i = x(
						function () {
							return Promise.resolve(y(e.hostname)).then(function (e) {
								n = e;
							});
						},
						function () {
							t.render("pages/index"), (r = 1);
						},
					);
				return Promise.resolve(i && i.then ? i.then(o) : o(i));
			} catch (e) {
				return Promise.reject(e);
			}
		}),
			e.get("/v1/:network/block/latest", function (e, t, r) {
				try {
					var n = x(
						function () {
							var r = t.json;
							return Promise.resolve(j(e.params.network)).then(function (e) {
								r.call(t, e);
							});
						},
						function (e) {
							r(e);
						},
					);
					return Promise.resolve(n && n.then ? n.then(function () {}) : void 0);
				} catch (e) {
					return Promise.reject(e);
				}
			}),
			e.get("/v1/:network/block/height/:height", function (e, t, r) {
				try {
					var n = x(
						function () {
							var r = t.json;
							return Promise.resolve(
								k(e.params.network, parseInt(e.params.height, 10)),
							).then(function (e) {
								r.call(t, e);
							});
						},
						function (e) {
							r(e);
						},
					);
					return Promise.resolve(n && n.then ? n.then(function () {}) : void 0);
				} catch (e) {
					return Promise.reject(e);
				}
			}),
			e.get("/v1/:network/block/hash/:hash", function (e, t, r) {
				try {
					var n = x(
						function () {
							var r = t.json;
							return Promise.resolve(b(e.params.network, e.params.hash)).then(
								function (e) {
									r.call(t, e);
								},
							);
						},
						function (e) {
							r(e);
						},
					);
					return Promise.resolve(n && n.then ? n.then(function () {}) : void 0);
				} catch (e) {
					return Promise.reject(e);
				}
			}),
			e.get("/v1/:network/tx/:txid", function (e, t) {
				try {
					t.set("Content-type", "application/octet-stream");
					var r = t.send;
					return Promise.resolve(w(e.params.network, e.params.txid)).then(
						function (e) {
							r.call(t, e);
						},
					);
				} catch (e) {
					return Promise.reject(e);
				}
			}),
			e.get("/:filename", function (e, t, r) {
				try {
					var n,
						o = e.params.filename;
					return Promise.resolve(
						x(
							function () {
								function r(e) {
									if (n) return e;
									F(u, t, s);
								}
								var i,
									u,
									s = !0,
									a = x(
										function () {
											return Promise.resolve(P(o, e.query.meta)).then(
												function (t) {
													var r;
													"ord-fs/json" !== (u = t).type ||
														e.query.raw ||
														(null == (r = e.res) ||
															r.redirect("/" + o + "/index.html"),
														(n = 1));
												},
											);
										},
										function (t) {
											return (
												console.error("Outpoint Error", o, t.message),
												Promise.resolve(y(e.hostname)).then(function (t) {
													return (
														(i = t),
														Promise.resolve(P(i)).then(function (t) {
															var r = JSON.parse(t.data.toString("utf8"));
															if (!r[o]) throw new f.default.NotFound();
															return (
																(i = r[o].slice(6)),
																Promise.resolve(P(i, e.query.meta)).then(
																	function (e) {
																		(u = e), (s = !1);
																	},
																)
															);
														})
													);
												})
											);
										},
									);
								return a && a.then ? a.then(r) : r(a);
							},
							function (e) {
								r(e);
							},
						),
					);
				} catch (e) {
					return Promise.reject(e);
				}
			}),
			e.get("/content/:pointer", function (e, t, r) {
				try {
					var n = e.params.pointer;
					return Promise.resolve(
						x(
							function () {
								return Promise.resolve(P(n, e.query.meta)).then(function (r) {
									var o;
									"ord-fs/json" !== r.type || e.query.raw
										? F(r, t, !0)
										: null == (o = e.res) ||
											o.redirect("/" + n + "/index.html");
								});
							},
							function (e) {
								r(e);
							},
						),
					);
				} catch (e) {
					return Promise.reject(e);
				}
			}),
			e.get("/preview/:b64HtmlData", function (e, t, r) {
				try {
					try {
						var n = Buffer.from(e.params.b64HtmlData, "base64").toString(
							"utf8",
						);
						t.render("pages/preview", { htmlData: n });
					} catch (e) {
						r(e);
					}
					return Promise.resolve();
				} catch (e) {
					return Promise.reject(e);
				}
			}),
			e.get("/:pointer/:filename", t),
			e.get("/content/:pointer/:filename", t);
	}),
		(e.getBlockByHash = b),
		(e.getBlockByHeight = k),
		(e.getLatestBlock = j),
		(e.getRawTx = w),
		(e.loadInscription = P),
		(e.loadPointerFromDNS = y),
		(e.parseScript = S);
});
//# sourceMappingURL=index.umd.js.map
