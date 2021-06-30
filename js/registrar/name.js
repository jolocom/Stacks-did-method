"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.revokeName = exports.preorderAndRegisterName = exports.rekeyName = void 0;
const bns_1 = require("@stacks/bns");
const { parseZoneFile, makeZoneFile } = require("zone-file");
const general_1 = require("../utils/general");
const utils_1 = require("./utils");
const transactions_1 = require("@stacks/transactions");
const fluture_1 = require("fluture");
const profile_1 = require("@stacks/profile");
const constants_1 = require("../constants");
const did_1 = require("../utils/did");
const preorderName = (name, namespace, keyPair, network, salt = "salt") => bns_1.buildPreorderNameTx({
    fullyQualifiedName: general_1.encodeFQN({ name, namespace }),
    salt,
    stxToBurn: constants_1.STX_TO_BURN,
    network,
    publicKey: keyPair.publicKey.data.toString("hex"),
}).then(async (tx) => {
    const signer = new transactions_1.TransactionSigner(tx);
    signer.signOrigin(keyPair.privateKey);
    return transactions_1.broadcastTransaction(tx, network).then((txId) => fluture_1.promise(utils_1.waitForConfirmation(txId, network)));
});
const registerName = (name, namespace, keyPair, zonefile, network, salt = "salt") => bns_1.buildRegisterNameTx({
    fullyQualifiedName: general_1.encodeFQN({ name, namespace }),
    publicKey: keyPair.publicKey.data.toString("hex"),
    salt,
    zonefile,
    network,
}).then(async (tx) => {
    const signer = new transactions_1.TransactionSigner(tx);
    signer.signOrigin(keyPair.privateKey);
    return transactions_1.broadcastTransaction(tx, network, Buffer.from(zonefile)).then((txId) => fluture_1.promise(utils_1.waitForConfirmation(txId, network).pipe(fluture_1.chain(() => utils_1.wait(5000)))).then(() => txId));
});
const rekeyName = async (name, namespace, currentKeyPair, newKeyPair, network) => {
    const fqn = general_1.encodeFQN({ name, namespace });
    const signed = profile_1.signProfileToken(new profile_1.Profile(), newKeyPair.privateKey.data.toString("hex"));
    const zf = profile_1.makeProfileZoneFile(fqn, await utils_1.storeTokenFile(profile_1.wrapProfileToken(signed)));
    const newOwnerAddress = transactions_1.getAddressFromPublicKey(newKeyPair.publicKey.data, transactions_1.TransactionVersion.Testnet);
    return bns_1.buildTransferNameTx({
        fullyQualifiedName: fqn,
        newOwnerAddress,
        network,
        zonefile: zf,
        publicKey: currentKeyPair.publicKey.data.toString("hex"),
    }).then(async (tx) => {
        const signer = new transactions_1.TransactionSigner(tx);
        signer.signOrigin(currentKeyPair.privateKey);
        return transactions_1.broadcastTransaction(tx, network, Buffer.from(zf)).then((txId) => fluture_1.promise(utils_1.waitForConfirmation(txId, network)
            .pipe(fluture_1.chain(() => utils_1.wait(5000)))
            .pipe(fluture_1.map(() => txId))));
    });
};
exports.rekeyName = rekeyName;
/**
 * Returns the DID for the newly registered name
 */
const preorderAndRegisterName = async (name, namespace, network, keyPair) => {
    const fqn = general_1.encodeFQN({ name, namespace });
    await preorderName(name, namespace, keyPair, network);
    const signed = profile_1.signProfileToken(new profile_1.Profile(), keyPair.privateKey.data.toString("hex"));
    const zf = profile_1.makeProfileZoneFile(fqn, await utils_1.storeTokenFile(profile_1.wrapProfileToken(signed)));
    return registerName(name, namespace, keyPair, zf, network).then((txId) => did_1.encodeStacksV2Did({
        address: transactions_1.publicKeyToAddress(transactions_1.AddressVersion.TestnetSingleSig, keyPair.publicKey),
        anchorTxId: txId,
    }));
};
exports.preorderAndRegisterName = preorderAndRegisterName;
const revokeName = async (name, namespace, keyPair, network) => bns_1.buildRevokeNameTx({
    fullyQualifiedName: general_1.encodeFQN({
        name,
        namespace,
    }),
    publicKey: keyPair.publicKey.data.toString("hex"),
    network,
}).then(async (tx) => {
    const s = new transactions_1.TransactionSigner(tx);
    s.signOrigin(keyPair.privateKey);
    return transactions_1.broadcastTransaction(tx, network).then((txId) => fluture_1.promise(utils_1.waitForConfirmation(txId, network)).then(() => txId));
});
exports.revokeName = revokeName;
//# sourceMappingURL=name.js.map