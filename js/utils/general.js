"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eitherToFuture = exports.createRejectedFuture = exports.normalizeAddress = exports.decodeFQN = exports.encodeFQN = exports.hexToAscii = exports.stripHexPrefixIfPresent = void 0;
const address_1 = require("c32check/lib/address");
const fluture_1 = require("fluture");
const stripHexPrefixIfPresent = (data) => {
    if (data.startsWith("0x"))
        return data.substr(2);
    return data;
};
exports.stripHexPrefixIfPresent = stripHexPrefixIfPresent;
const hexToAscii = (hex) => Buffer.from(exports.stripHexPrefixIfPresent(hex), "hex").toString("ascii");
exports.hexToAscii = hexToAscii;
const encodeFQN = (args) => {
    const { name, subdomain, namespace } = args;
    return `${subdomain ? subdomain + "." : ""}${name}.${namespace}`;
};
exports.encodeFQN = encodeFQN;
const decodeFQN = (fqdn) => {
    const nameParts = fqdn.split(".");
    if (nameParts.length > 2) {
        const subdomain = nameParts[0];
        const name = nameParts[1];
        const namespace = nameParts[2];
        return {
            subdomain,
            name,
            namespace,
        };
    }
    else {
        const name = nameParts[0];
        const namespace = nameParts[1];
        return {
            name,
            namespace,
        };
    }
};
exports.decodeFQN = decodeFQN;
// Given a testnet, or a mainnet c32 encoded address, will return the b58 encoded uncompressed address
const normalizeAddress = (address) => {
    try {
        const [version, hash] = address_1.c32addressDecode(address);
        if (version === 22) {
            return address_1.c32ToB58(address);
        }
        if (version === 26) {
            return address_1.c32ToB58(address_1.c32address(22, hash));
        }
        throw new Error("Unknown version number, " + version);
    }
    catch (_a) {
        return address;
    }
};
exports.normalizeAddress = normalizeAddress;
const createRejectedFuture = (rejectWith) => {
    return fluture_1.reject(rejectWith);
};
exports.createRejectedFuture = createRejectedFuture;
const eitherToFuture = (either) => {
    return either.fold((v) => exports.createRejectedFuture(v), fluture_1.resolve);
};
exports.eitherToFuture = eitherToFuture;
//# sourceMappingURL=general.js.map