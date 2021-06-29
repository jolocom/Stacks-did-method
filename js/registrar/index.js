"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSubdomain = exports.updateName = exports.revokeName = exports.preorderAndRegisterName = exports.registerNamespace = exports.rotateKey = void 0;
const bns_1 = require("@stacks/bns");
const { parseZoneFile, makeZoneFile } = require("zone-file");
const general_1 = require("../utils/general");
const utils_1 = require("./utils");
const transactions_1 = require("@stacks/transactions");
const form_data_1 = __importDefault(require("form-data"));
const constants_1 = require("./constants");
const fluture_1 = require("fluture");
const profile_1 = require("@stacks/profile");
const api_1 = require("../api");
const constants_2 = require("../constants");
const did_1 = require("../utils/did");
const preorderNamespace = async (namespace, network, keyPair) => {
    console.log(`PREORDERING NAMESPACE - ${namespace}, BURNING - ${constants_2.STX_TO_BURN.toString()}`);
    return bns_1.buildPreorderNamespaceTx({
        namespace,
        salt: "salt",
        stxToBurn: constants_2.STX_TO_BURN,
        publicKey: keyPair.publicKey.data.toString("hex"),
        network,
    }).then(async (tx) => {
        const s = new transactions_1.TransactionSigner(tx);
        s.signOrigin(keyPair.privateKey);
        return transactions_1.broadcastTransaction(tx, network).then((txId) => {
            //@ts-ignore string and error
            return fluture_1.promise(utils_1.waitForConfirmation(txId)).then(() => txId);
        });
    });
};
const revealNamespace = (namespace, network, keyPair) => {
    console.log(`REVEALING NAMESPACE - ${namespace}`);
    return bns_1.buildRevealNamespaceTx({
        namespace,
        salt: "salt",
        priceFunction: constants_1.priceFunction,
        lifetime: constants_1.lifetime,
        namespaceImportAddress: transactions_1.getAddressFromPublicKey(keyPair.publicKey.data, transactions_1.TransactionVersion.Testnet),
        publicKey: keyPair.publicKey.data.toString("hex"),
        network,
    }).then((tx) => {
        const s = new transactions_1.TransactionSigner(tx);
        s.signOrigin(keyPair.privateKey);
        return transactions_1.broadcastTransaction(tx, network).then((txId) => {
            //@ts-ignore
            return fluture_1.promise(utils_1.waitForConfirmation(txId)).then(() => txId);
        });
    });
};
const readyNamespace = (namespace, network, keyPair) => {
    console.log(`READYING NAMESPACE - ${namespace}`);
    return bns_1.buildReadyNamespaceTx({
        network,
        namespace,
        publicKey: keyPair.publicKey.data.toString("hex"),
    }).then(async (tx) => {
        const s = new transactions_1.TransactionSigner(tx);
        s.signOrigin(keyPair.privateKey);
        return transactions_1.broadcastTransaction(tx, network).then((txId) => {
            //@ts-ignore
            return fluture_1.promise(utils_1.waitForConfirmation(txId)).then(() => txId);
        });
    });
};
const preorderName = (name, namespace, keyPair, network) => {
    const fqn = general_1.encodeFQN({ name, namespace });
    console.log(`PREORDERING NAME - ${fqn}`);
    return bns_1.buildPreorderNameTx({
        fullyQualifiedName: fqn,
        salt: "salt",
        stxToBurn: constants_2.STX_TO_BURN,
        network,
        publicKey: keyPair.publicKey.data.toString("hex"),
    }).then((tx) => {
        const signer = new transactions_1.TransactionSigner(tx);
        signer.signOrigin(keyPair.privateKey);
        return transactions_1.broadcastTransaction(tx, network).then((txId) => {
            //@ts-ignore
            return fluture_1.promise(utils_1.waitForConfirmation(txId)).then(() => txId);
        });
    });
};
const registerName = (name, namespace, keyPair, zonefile, network) => {
    const fqn = general_1.encodeFQN({ name, namespace });
    console.log(`REGISTERING NAME - ${fqn}`);
    return bns_1.buildRegisterNameTx({
        fullyQualifiedName: fqn,
        publicKey: keyPair.publicKey.data.toString("hex"),
        salt: "salt",
        zonefile,
        network,
    }).then((tx) => {
        const signer = new transactions_1.TransactionSigner(tx);
        signer.signOrigin(keyPair.privateKey);
        return transactions_1.broadcastTransaction(tx, network, Buffer.from(zonefile)).then((txId) => {
            //@ts-ignore
            return fluture_1.promise(utils_1.waitForConfirmation(txId).pipe(fluture_1.chain(() => utils_1.wait(5000)))).then(() => txId);
        });
    });
};
const transferName = async (name, namespace, currentKeyPair, newKeyPair, network) => {
    const fqn = general_1.encodeFQN({ name, namespace });
    console.log(`TRANSFERRING NAME - ${fqn}`);
    const signed = profile_1.signProfileToken(new profile_1.Profile(), newKeyPair.privateKey.data.toString("hex"));
    const zf = profile_1.makeProfileZoneFile(fqn, await storeTokenFile(profile_1.wrapProfileToken(signed)));
    const newOwnerAddress = transactions_1.getAddressFromPublicKey(newKeyPair.publicKey.data, transactions_1.TransactionVersion.Testnet);
    return bns_1.buildTransferNameTx({
        fullyQualifiedName: fqn,
        newOwnerAddress,
        network,
        zonefile: zf,
        publicKey: currentKeyPair.publicKey.data.toString("hex"),
    }).then((tx) => {
        const signer = new transactions_1.TransactionSigner(tx);
        signer.signOrigin(currentKeyPair.privateKey);
        return transactions_1.broadcastTransaction(tx, network, Buffer.from(zf)).then((txId) => {
            // @ts-ignore
            return fluture_1.promise(
            //@ts-ignore Waiting for the zonefile to propagate
            utils_1.waitForConfirmation(txId)
                .pipe(fluture_1.chain(() => utils_1.wait(5000)))
                .pipe(fluture_1.map(() => txId)));
        });
    });
};
// Not currently used
const renewName = async (name, namespace, currentKeyPair, newKeyPair, network) => {
    const fqn = general_1.encodeFQN({ name, namespace });
    console.log(`RENEWING NAME - ${fqn}`);
    const signed = profile_1.signProfileToken(new profile_1.Profile(), newKeyPair.privateKey.data.toString("hex"));
    const zf = profile_1.makeProfileZoneFile(fqn, await storeTokenFile(profile_1.wrapProfileToken(signed)));
    const newOwnerAddress = transactions_1.getAddressFromPublicKey(newKeyPair.publicKey.data, transactions_1.TransactionVersion.Testnet);
    return bns_1.buildRenewNameTx({
        fullyQualifiedName: fqn,
        stxToBurn: constants_2.STX_TO_BURN,
        newOwnerAddress,
        network,
        zonefile: zf,
        publicKey: currentKeyPair.publicKey.data.toString("hex"),
    }).then((tx) => {
        const signer = new transactions_1.TransactionSigner(tx);
        signer.signOrigin(currentKeyPair.privateKey);
        return transactions_1.broadcastTransaction(tx, network, Buffer.from(zf)).then((txId) => {
            // @ts-ignore
            return fluture_1.promise(
            //@ts-ignore Waiting for the zonefile to propagate
            utils_1.waitForConfirmation(txId)
                .pipe(fluture_1.chain(() => utils_1.wait(5000)))
                .pipe(fluture_1.chain(() => api_1.fetchNameInfo({ name, namespace }))));
        });
    });
};
exports.rotateKey = transferName;
const registerNamespace = async (namespace, network, keyPair) => {
    await preorderNamespace(namespace, network, keyPair);
    await revealNamespace(namespace, network, keyPair);
    await readyNamespace(namespace, network, keyPair);
};
exports.registerNamespace = registerNamespace;
const preorderAndRegisterName = async (name, namespace, network, keyPair) => {
    const fqn = general_1.encodeFQN({ name, namespace });
    await preorderName(name, namespace, keyPair, network);
    const signed = profile_1.signProfileToken(new profile_1.Profile(), keyPair.privateKey.data.toString("hex"));
    const zf = profile_1.makeProfileZoneFile(fqn, await storeTokenFile(profile_1.wrapProfileToken(signed)));
    return await registerName(name, namespace, keyPair, zf, network);
};
exports.preorderAndRegisterName = preorderAndRegisterName;
const revokeName = async (fqn, keyPair, network) => {
    console.log(`REVOKING NAME - ${fqn}`);
    return bns_1.buildRevokeNameTx({
        fullyQualifiedName: fqn,
        publicKey: keyPair.publicKey.data.toString("hex"),
        network,
    }).then(async (tx) => {
        const s = new transactions_1.TransactionSigner(tx);
        s.signOrigin(keyPair.privateKey);
        return transactions_1.broadcastTransaction(tx, network).then((txId) => fluture_1.promise(utils_1.waitForConfirmation(txId)).then(() => txId));
    });
};
exports.revokeName = revokeName;
const storeTokenFile = async (data) => {
    const fd = new form_data_1.default();
    fd.append("file", Buffer.from(JSON.stringify([data])));
    const res = await fetch(`https://ipfs.jolocom.io/api/v0/add?pin=false`, {
        method: "POST",
        //@ts-ignore
        body: fd,
    });
    const { Hash } = await res.json();
    return `https://ipfs.jolocom.io/api/v0/cat/${Hash}`;
};
const updateName = async (fqn, newZoneFile, keyPair, network) => {
    return bns_1.buildUpdateNameTx({
        fullyQualifiedName: fqn,
        zonefile: newZoneFile,
        publicKey: keyPair.publicKey.data.toString("hex"),
        network,
    }).then(async (tx) => {
        const s = new transactions_1.TransactionSigner(tx);
        s.signOrigin(keyPair.privateKey);
        return transactions_1.broadcastTransaction(tx, network, Buffer.from(newZoneFile)).then((txId) => fluture_1.promise(utils_1.waitForConfirmation(txId)).then(() => txId));
    });
};
exports.updateName = updateName;
const registerSubdomain = async (fqn, nameOwnerKey, subdomainOptions, network) => {
    var _a;
    const { name, namespace, subdomain } = general_1.decodeFQN(fqn);
    if (!subdomain) {
        throw new Error("provided fqn must include subdomain");
    }
    const currentZf = await fluture_1.promise(api_1.fetchZoneFileForName({
        name,
        namespace,
    }));
    const parsed = parseZoneFile(currentZf);
    const subdomainZoneFile = await buildSubdomainZoneFile(fqn, subdomainOptions.ownerKeyPair);
    const address = transactions_1.publicKeyToAddress(transactions_1.AddressVersion.TestnetSingleSig, transactions_1.getPublicKey(subdomainOptions.ownerKeyPair.privateKey));
    const owner = subdomainOptions.owner || address;
    const newSubdomainOp = subdomainOpToZFPieces(subdomainZoneFile, general_1.normalizeAddress(owner), subdomain);
    if ((_a = parsed === null || parsed === void 0 ? void 0 : parsed.txt) === null || _a === void 0 ? void 0 : _a.length) {
        parsed.txt.push(newSubdomainOp);
    }
    else {
        parsed.txt = [newSubdomainOp];
    }
    const ZONEFILE_TEMPLATE = "{$origin}\n{$ttl}\n{txt}{uri}";
    const txId = await exports.updateName(general_1.encodeFQN({ name, namespace }), makeZoneFile(parsed, ZONEFILE_TEMPLATE), nameOwnerKey, network);
    return did_1.encodeStacksV2Did({
        address: owner,
        anchorTxId: txId,
    });
};
exports.registerSubdomain = registerSubdomain;
const buildSubdomainZoneFile = async (fqn, keyPair) => {
    const signedToken = profile_1.signProfileToken(new profile_1.Profile(), keyPair.privateKey.data.toString("hex"));
    const zf = profile_1.makeProfileZoneFile(fqn, await storeTokenFile(profile_1.wrapProfileToken(signedToken)));
    return zf;
};
function subdomainOpToZFPieces(zonefile, owner, subdomainName, signature) {
    const destructedZonefile = destructZonefile(zonefile);
    const txt = [`owner=${owner}`, `seqn=0`, `parts=${destructedZonefile.length}`];
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
//# sourceMappingURL=index.js.map