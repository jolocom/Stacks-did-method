"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolve = void 0;
const ramda_1 = require("ramda");
const transactions_1 = require("./utils/transactions");
const signedToken_1 = require("./utils/signedToken");
const general_1 = require("./utils/general");
const did_1 = require("./utils/did");
const zonefile_1 = require("./utils/zonefile");
const api_1 = require("./api");
const fluture_1 = require("fluture");
const getPublicKeyForMigratedDid = ({ address, anchorTxId }) => api_1.fetchNamesOwnedByAddress(address)
    .pipe(fluture_1.map((names) => names[0]))
    .pipe(fluture_1.map(general_1.decodeFQN))
    .pipe(fluture_1.chain(api_1.fetchNameInfo))
    .pipe(fluture_1.chain((nameInfo) => {
    if (nameInfo.last_txid === "0x" &&
        nameInfo.status !== "name-register") {
        // TODO What if a migrated name has since been updated? How do we handle this case?
        return fluture_1.reject(new Error(`Verifying name-record for migrated DID failed, expected last_txid to be 0x, got ${anchorTxId}`));
    }
    if (nameInfo.address !== address) {
        return fluture_1.reject(new Error(`Verifying name-record failed, expected name owner to match address, got ${address}`));
    }
    return zonefile_1.parseZoneFileAndExtractNameinfo(address)(nameInfo.zonefile)
        .map((nameInfo) => api_1.fetchSignedToken(nameInfo.tokenUrl)
        .pipe(fluture_1.map(signedToken_1.verifyTokenAndGetPubKey(general_1.normalizeAddress(nameInfo.owner))))
        .pipe(fluture_1.map((key) => key.map((k) => ({
        name: general_1.encodeFQN(nameInfo),
        publicKey: k,
    }))))
        .pipe(fluture_1.chain((e) => e.fold(fluture_1.reject, (v) => fluture_1.resolve(v)))))
        .fold(fluture_1.reject, ramda_1.identity);
}));
const getPublicKeyForDID = (did) => api_1.fetchTransactionById(did.anchorTxId).pipe(fluture_1.chain((tx) => transactions_1.parseAndValidateTransaction(tx)
    .map(({ name, namespace, zonefileHash }) => api_1.fetchZoneFileForName({ name, namespace, zonefileHash })
    .pipe(fluture_1.map(zonefile_1.getZonefileRecordsForName({
    owner: did.address,
    name,
    namespace,
})))
    .pipe(fluture_1.map((zf) => zf.flatMap(zonefile_1.parseZoneFileAndExtractNameinfo(did.address))))
    .pipe(fluture_1.map((zf) => zf.map(({ tokenUrl, namespace, name, subdomain }) => api_1.fetchSignedToken(tokenUrl)
    .pipe(fluture_1.map(signedToken_1.verifyTokenAndGetPubKey(general_1.normalizeAddress(did.address))))
    .pipe(fluture_1.map((key) => key.map((k) => ({
    name: general_1.encodeFQN({ name, namespace, subdomain }),
    publicKey: k,
})))))))
    .pipe(fluture_1.chain((p) => p.fold(fluture_1.reject, ramda_1.identity))))
    .fold(fluture_1.reject, ramda_1.identity)
    .pipe(fluture_1.chain((res) => res.fold(fluture_1.reject, (v) => fluture_1.resolve(v))))));
const postResolve = (name, did, initialPubKey) => {
    const fqn = general_1.decodeFQN(name);
    // TODO Can subdmains be revoked? How would we find out?
    // Current assumption is that we can not easily check for this
    //
    if (fqn.subdomain) {
        return fluture_1.resolve({
            did,
            publicKey: initialPubKey,
        });
    }
    return api_1.fetchNameInfo(fqn).pipe(fluture_1.chain((currentInfo) => {
        if (currentInfo.status === "name-revoke") {
            return general_1.createRejectedFuture(new Error("Name bound to DID was revoked"));
        }
        return api_1.getCurrentBlockNumber().pipe(fluture_1.chain((currentBlock) => {
            if (currentInfo.expire_block > currentBlock) {
                return general_1.createRejectedFuture(new Error("Name bound to DID expired"));
            }
            return zonefile_1.getZonefileRecordsForName(Object.assign(Object.assign({}, fqn), { owner: currentInfo.address }))(currentInfo.zonefile)
                .flatMap(zonefile_1.parseZoneFileAndExtractNameinfo(currentInfo.address))
                .fold(fluture_1.reject, ({ tokenUrl }) => api_1.fetchSignedToken(tokenUrl))
                .pipe(fluture_1.map(signedToken_1.verifyTokenAndGetPubKey(general_1.normalizeAddress(currentInfo.address))))
                .pipe(fluture_1.chain((newInfo) => newInfo.fold(() => fluture_1.resolve({ did, publicKey: initialPubKey }), (newKey) => fluture_1.resolve({ publicKey: newKey, did }))));
        }));
    }));
};
const resolve = (did) => fluture_1.promise(did_1.parseStacksV2DID(did)
    .map((parsedDID) => (did_1.isMigratedOnChainDid(parsedDID)
    ? getPublicKeyForMigratedDid(parsedDID)
    : getPublicKeyForDID(parsedDID)).pipe(fluture_1.chain(({ name, publicKey }) => postResolve(name, did, publicKey).pipe(fluture_1.map(did_1.buildDidDoc)))))
    .fold(fluture_1.reject, ramda_1.identity));
exports.resolve = resolve;
//# sourceMappingURL=resolver.js.map