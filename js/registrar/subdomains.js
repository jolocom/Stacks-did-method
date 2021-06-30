"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.revokeSubdomain = exports.rekeySubdomain = exports.registerSubdomain = void 0;
const bns_1 = require("@stacks/bns");
const transactions_1 = require("@stacks/transactions");
const general_1 = require("../utils/general");
const utils_1 = require("./utils");
const transactions_2 = require("@stacks/transactions");
const fluture_1 = require("fluture");
const profile_1 = require("@stacks/profile");
const api_1 = require("../api");
const did_1 = require("../utils/did");
const zonefile_1 = require("../utils/zonefile");
const { parseZoneFile, makeZoneFile } = require("zone-file");
const registerSubdomain = async (fqn, nameOwnerKey, subdomainOptions, network) => exports.rekeySubdomain(fqn, nameOwnerKey, {
    newOwnerAddress: subdomainOptions.owner,
    newOwnerKeyPair: subdomainOptions.ownerKeyPair,
}, network);
exports.registerSubdomain = registerSubdomain;
const rekeySubdomain = async (fqn, nameOwnerKey, subdomainOptions, network) => {
    var _a, _b;
    const { name, namespace, subdomain } = general_1.decodeFQN(fqn);
    if (!subdomain) {
        throw new Error("provided fqn must include subdomain");
    }
    const zf = await fluture_1.promise(api_1.fetchZoneFileForName(network.coreApiUrl)({
        name,
        namespace,
    }));
    console.log(zf);
    const currentZf = parseZoneFile(zf);
    const subdomainZF = await buildSubdomainZoneFile(fqn, subdomainOptions.newOwnerKeyPair);
    const owner = subdomainOptions.newOwnerAddress ||
        transactions_2.publicKeyToAddress(transactions_2.AddressVersion.TestnetSingleSig, transactions_2.getPublicKey(subdomainOptions.newOwnerKeyPair.privateKey));
    const existingRecordIdx = (_a = currentZf === null || currentZf === void 0 ? void 0 : currentZf.txt) === null || _a === void 0 ? void 0 : _a.findIndex((record) => record.name === subdomain);
    const newSubdomainOp = subdomainOpToZFPieces(subdomainZF, general_1.normalizeAddress(owner), subdomain, existingRecordIdx >= 0
        ? 1 +
            parseInt(zonefile_1.parseZoneFileTXT(currentZf.txt[existingRecordIdx].txt).seqn)
        : 0);
    if ((_b = currentZf === null || currentZf === void 0 ? void 0 : currentZf.txt) === null || _b === void 0 ? void 0 : _b.length) {
        if (existingRecordIdx >= 0) {
            currentZf.txt[existingRecordIdx] = newSubdomainOp;
        }
        else {
            currentZf.txt.push(newSubdomainOp);
        }
    }
    else {
        currentZf.txt = [newSubdomainOp];
    }
    const ZONEFILE_TEMPLATE = "{$origin}\n{$ttl}\n{txt}{uri}";
    const txId = await updateName(general_1.encodeFQN({ name, namespace }), makeZoneFile(currentZf, ZONEFILE_TEMPLATE), nameOwnerKey, network);
    return did_1.encodeStacksV2Did({
        anchorTxId: txId,
        address: transactions_2.publicKeyToAddress(transactions_2.AddressVersion.TestnetSingleSig, transactions_2.getPublicKey(subdomainOptions.newOwnerKeyPair.privateKey)),
    });
};
exports.rekeySubdomain = rekeySubdomain;
const revokeSubdomain = async (fqn, nameOwnerKey, network) => {
    const revokeAddr = "1111111111111111111114oLvT2";
    const randomKey = utils_1.getKeyPair();
    return exports.rekeySubdomain(fqn, nameOwnerKey, {
        newOwnerAddress: revokeAddr,
        newOwnerKeyPair: randomKey,
    }, network);
};
exports.revokeSubdomain = revokeSubdomain;
const buildSubdomainZoneFile = async (fqn, keyPair, signedTokenUrl) => {
    const signedToken = profile_1.signProfileToken(new profile_1.Profile(), keyPair.privateKey.data.toString("hex"));
    const zf = profile_1.makeProfileZoneFile(fqn, signedTokenUrl || (await utils_1.storeTokenFile(profile_1.wrapProfileToken(signedToken))));
    return zf;
};
function subdomainOpToZFPieces(zonefile, owner, subdomainName, seqn = 0, signature) {
    const destructedZonefile = destructZonefile(zonefile);
    const txt = [
        `owner=${owner}`,
        `seqn=${seqn}`,
        `parts=${destructedZonefile.length}`,
    ];
    destructedZonefile.forEach((zfPart, ix) => txt.push(`zf${ix}=${zfPart}`));
    if (signature) {
        txt.push(`sig=${signature}`);
    }
    return {
        name: subdomainName,
        txt,
    };
}
function destructZonefile(zonefile) {
    const encodedZonefile = Buffer.from(zonefile).toString("base64");
    // we pack into 250 byte strings -- the entry "zf99=" eliminates 5 useful bytes,
    // and the max is 255.
    const pieces = 1 + Math.floor(encodedZonefile.length / 250);
    const destructed = [];
    for (let i = 0; i < pieces; i++) {
        const startIndex = i * 250;
        const currentPiece = encodedZonefile.slice(startIndex, startIndex + 250);
        if (currentPiece.length > 0) {
            destructed.push(currentPiece);
        }
    }
    return destructed;
}
const updateName = async (fqn, newZoneFile, keyPair, network) => {
    return bns_1.buildUpdateNameTx({
        fullyQualifiedName: fqn,
        zonefile: newZoneFile,
        publicKey: keyPair.publicKey.data.toString("hex"),
        network,
    }).then(async (tx) => {
        const s = new transactions_1.TransactionSigner(tx);
        s.signOrigin(keyPair.privateKey);
        return transactions_1.broadcastTransaction(tx, network, Buffer.from(newZoneFile)).then((txId) => fluture_1.promise(utils_1.waitForConfirmation(txId, network)).then(() => txId));
    });
};
//# sourceMappingURL=subdomains.js.map