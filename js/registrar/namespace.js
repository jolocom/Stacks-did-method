"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerNamespace = void 0;
const bns_1 = require("@stacks/bns");
const utils_1 = require("./utils");
const transactions_1 = require("@stacks/transactions");
const constants_1 = require("./constants");
const fluture_1 = require("fluture");
const preorderNamespace = async (namespace, network, keyPair, salt = "salt") => {
    return bns_1.buildPreorderNamespaceTx({
        namespace,
        salt,
        stxToBurn: constants_1.STX_TO_BURN,
        publicKey: keyPair.publicKey.data.toString("hex"),
        network,
    }).then(async (tx) => {
        const s = new transactions_1.TransactionSigner(tx);
        s.signOrigin(keyPair.privateKey);
        return transactions_1.broadcastTransaction(tx, network).then((txId) => fluture_1.promise(utils_1.waitForConfirmation(txId, network)));
    });
};
const revealNamespace = (namespace, network, keyPair, salt = "salt") => bns_1.buildRevealNamespaceTx({
    namespace,
    salt,
    priceFunction: constants_1.priceFunction,
    lifetime: constants_1.lifetime,
    namespaceImportAddress: transactions_1.getAddressFromPublicKey(keyPair.publicKey.data, transactions_1.TransactionVersion.Testnet),
    publicKey: keyPair.publicKey.data.toString("hex"),
    network,
}).then(async (tx) => {
    const s = new transactions_1.TransactionSigner(tx);
    s.signOrigin(keyPair.privateKey);
    return transactions_1.broadcastTransaction(tx, network).then((txId) => fluture_1.promise(utils_1.waitForConfirmation(txId, network)));
});
const readyNamespace = (namespace, network, keyPair) => bns_1.buildReadyNamespaceTx({
    network,
    namespace,
    publicKey: keyPair.publicKey.data.toString("hex"),
}).then(async (tx) => {
    const s = new transactions_1.TransactionSigner(tx);
    s.signOrigin(keyPair.privateKey);
    return transactions_1.broadcastTransaction(tx, network).then((txId) => fluture_1.promise(utils_1.waitForConfirmation(txId, network)));
});
const registerNamespace = async (namespace, network, keyPair) => {
    await preorderNamespace(namespace, network, keyPair);
    await revealNamespace(namespace, network, keyPair);
    await readyNamespace(namespace, network, keyPair);
};
exports.registerNamespace = registerNamespace;
//# sourceMappingURL=namespace.js.map