"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getResolver = void 0;
const ramda_1 = require("ramda");
const signedToken_1 = require("./utils/signedToken");
const general_1 = require("./utils/general");
const did_1 = require("./utils/did");
const zonefile_1 = require("./utils/zonefile");
const api_1 = require("./api");
const fluture_1 = require("fluture");
const migrated_1 = require("./migrated");
const bns_1 = require("./utils/bns");
const monet_1 = require("monet");
const network_1 = require("@stacks/network");
const getPublicKeyForDID = (did, network) => 
//@ts-ignore
bns_1.mapDidToBNSName(did, network).pipe(fluture_1.chain(({ name, namespace, subdomain, tokenUrl }) => signedToken_1.fetchAndVerifySignedToken(tokenUrl, did.address).pipe(fluture_1.map((key) => ({
    publicKey: key,
    name: general_1.encodeFQN({ name, namespace, subdomain }),
})))));
const postResolve = (name, did, network) => {
    const fqn = general_1.decodeFQN(name);
    return api_1.fetchNameInfo(network)(fqn).pipe(fluture_1.chain((currentInfo) => {
        if (currentInfo.status === "name-revoke") {
            return general_1.createRejectedFuture(new Error("Name bound to DID was revoked"));
        }
        return api_1.getCurrentBlockNumber(network.coreApiUrl)
            .pipe(fluture_1.chain((currentBlock) => {
            if (currentInfo.expire_block > currentBlock) {
                return general_1.createRejectedFuture(new Error("Name bound to DID expired"));
            }
            return fluture_1.resolve(true);
        }))
            .pipe(fluture_1.map(() => fqn.subdomain
            ? zonefile_1.findSubdomainZoneFileByName(currentInfo.zonefile, fqn.subdomain)
            : monet_1.Right({
                zonefile: currentInfo.zonefile,
                subdomain: undefined,
                owner: currentInfo.address,
            })))
            .pipe(fluture_1.map((v) => v.flatMap(({ zonefile, subdomain, owner }) => {
            return zonefile_1.ensureZonefileMatchesName({
                zonefile,
                name: fqn.name,
                namespace: fqn.namespace,
                subdomain,
            })
                .flatMap(zonefile_1.parseZoneFileAndExtractNameinfo)
                .map((nameInfo) => (Object.assign(Object.assign({}, nameInfo), { owner })));
        })))
            .pipe(fluture_1.chain((eith) => general_1.eitherToFuture(eith)))
            .pipe(fluture_1.chain(({ tokenUrl, owner }) => signedToken_1.fetchAndVerifySignedToken(tokenUrl, owner)))
            .pipe(fluture_1.mapRej((err) => new Error(`PostResolution: failed to fetch latest public key, error: ${err.message}`)))
            .pipe(fluture_1.map((publicKey) => ({ publicKey, did })));
    }));
};
const getResolver = (stacksNetwork = new network_1.StacksMainnet()) => {
    const resolve = (did) => fluture_1.promise(did_1.parseStacksV2DID(did)
        .map((parsedDID) => (did_1.isMigratedOnChainDid(parsedDID)
        ? migrated_1.getPublicKeyForMigratedDid(parsedDID, stacksNetwork)
        : getPublicKeyForDID(parsedDID, stacksNetwork)).pipe(fluture_1.chain(({ name }) => postResolve(name, did, stacksNetwork).pipe(fluture_1.map(did_1.buildDidDoc)))))
        .fold((e) => general_1.createRejectedFuture(e), ramda_1.identity));
    // @TODO integrate with DID resolver
    return resolve;
};
exports.getResolver = getResolver;
//# sourceMappingURL=resolver.js.map