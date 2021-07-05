"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.debug = exports.findValidNames = void 0;
const did_1 = require("./did");
const general_1 = require("./general");
const api_1 = require("../api");
const monet_1 = require("monet");
const fluture_1 = require("fluture");
const ramda_1 = require("ramda");
const findValidNames = (network, onlyMigrated = false) => (page = 0) => {
    return api_1.fetchAllNames(network.coreApiUrl)(page).pipe(fluture_1.map(ramda_1.map((fqn) => {
        const { name, namespace } = general_1.decodeFQN(fqn);
        return api_1.fetchNameInfo(network)({ name, namespace }).pipe(fluture_1.chain((info) => {
            if (onlyMigrated && info["last_txid"] !== "0x") {
                return fluture_1.resolve(monet_1.None());
            }
            return api_1.fetchZoneFileForName(network.coreApiUrl)({
                name,
                namespace,
            })
                .pipe(fluture_1.mapRej(() => monet_1.None()))
                .pipe(fluture_1.map((res) => res
                ? monet_1.Some({
                    did: did_1.encodeStacksV2Did({
                        address: info.address,
                        anchorTxId: info["last_txid"],
                    }),
                    zonefile: res,
                })
                : monet_1.None()))
                .pipe(fluture_1.map((v) => exports.debug("new entry")(v.orNull())));
        }));
    })));
};
exports.findValidNames = findValidNames;
const debug = (prefix) => (arg) => {
    console.log(prefix && prefix + "-", arg);
    return arg;
};
exports.debug = debug;
//# sourceMappingURL=dev.js.map