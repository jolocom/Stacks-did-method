"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicKeyForMigratedDid = void 0;
const ramda_1 = require("ramda");
const general_1 = require("./utils/general");
const zonefile_1 = require("./utils/zonefile");
const api_1 = require("./api");
const fluture_1 = require("fluture");
const getPublicKeyForMigratedDid = ({ address, anchorTxId }, network) => api_1.fetchNamesOwnedByAddress(network.coreApiUrl)(address)
    .pipe(fluture_1.map((names) => names[0])) // One principal can only map to one on-chain name, therefore we don't expect to receive multiple results here
    .pipe(fluture_1.map(general_1.decodeFQN))
    .pipe(fluture_1.chain(api_1.fetchNameInfo(network.coreApiUrl)))
    .pipe(fluture_1.chain((nameInfo) => {
    if (nameInfo.last_txid === "0x" &&
        nameInfo.status !== "name-register") {
        // TODO What if a migrated name has since been updated? How do we handle this case?
        return fluture_1.reject(new Error(`Verifying name-record for migrated DID failed, expected last_txid to be 0x, got ${anchorTxId}`));
    }
    if (general_1.normalizeAddress(nameInfo.address) !== general_1.normalizeAddress(address)) {
        return fluture_1.reject(new Error(`Verifying name-record failed, expected name owner to match address, got ${address}`));
    }
    return zonefile_1.parseZoneFileAndExtractNameinfo(nameInfo.zonefile)
        .map(({ name, namespace, subdomain }) => zonefile_1.getPublicKeyUsingZoneFile(nameInfo.zonefile, nameInfo.address)
        .pipe(fluture_1.map((key) => ({
        name: general_1.encodeFQN({
            name,
            namespace,
            subdomain,
        }),
        publicKey: key,
    }))))
        .fold(fluture_1.reject, ramda_1.identity);
}));
exports.getPublicKeyForMigratedDid = getPublicKeyForMigratedDid;
//# sourceMappingURL=migrated.js.map