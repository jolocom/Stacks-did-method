"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMigratedOnChainDid = exports.encodeStacksV2Did = exports.parseStacksV2DID = exports.buildDidDoc = void 0;
const constants_1 = require("../constants");
const general_1 = require("./general");
const ramda_1 = require("ramda");
const monet_1 = require("monet");
const address_1 = require("c32check/lib/address");
const b58 = require("bs58");
const buildDidDoc = ({ did, publicKey, }) => {
    return {
        "@context": "https://www.w3.org/ns/did/v1",
        id: did,
        verificationMethod: [
            {
                id: `${did}#keys-1`,
                controller: `${did}`,
                type: "EcdsaSecp256k1VerificationKey2019",
                publicKeyBase58: b58.encode(Buffer.from(publicKey, "hex")),
            },
        ],
        authentication: [`${did}#keys-1`],
        assertionMethod: [`${did}#keys-1`],
    };
};
exports.buildDidDoc = buildDidDoc;
const parseStacksV2DID = (did) => {
    if (!did.startsWith(constants_1.DID_METHOD_PREFIX + ":")) {
        return monet_1.Left(new Error(`DID "${did}" has incorrect DID method identifier, should start with ${constants_1.DID_METHOD_PREFIX}`));
    }
    const nsi = ramda_1.last(ramda_1.split(":", did));
    if (!nsi) {
        return monet_1.Left(new Error(`Failed to parse DID, missing NSI`));
    }
    const [address, anchorTxId] = ramda_1.split("-", nsi);
    if (!address || !anchorTxId) {
        return monet_1.Left(new Error(`address or txId undefined, got addr - ${address}, txId - ${anchorTxId}`));
    }
    return getDidType(address).map((metadata) => ({
        prefix: constants_1.DID_METHOD_PREFIX,
        address,
        metadata,
        anchorTxId,
    }));
};
exports.parseStacksV2DID = parseStacksV2DID;
const encodeStacksV2Did = (did) => `${constants_1.DID_METHOD_PREFIX}:${did.address}-${general_1.stripHexPrefixIfPresent(did.anchorTxId)}`;
exports.encodeStacksV2Did = encodeStacksV2Did;
const isMigratedOnChainDid = (did) => {
    if (typeof did === "string") {
        return exports.parseStacksV2DID(did).map(({ anchorTxId }) => {
            Object.values(constants_1.BNS_CONTRACT_DEPLOY_TXID).includes(anchorTxId);
        });
    }
    return Object.values(constants_1.BNS_CONTRACT_DEPLOY_TXID).includes(did.anchorTxId);
};
exports.isMigratedOnChainDid = isMigratedOnChainDid;
/**
 * Helper function which parses a c32 encoded address and determines whether the address
 * corresponds to an on-chain DID or an off-chain DID (depending on the AddressVersion)
 */
const getDidType = (addr) => {
    const [versionByte, _] = address_1.c32addressDecode(addr);
    const didTypeAndNetwork = constants_1.versionByteToDidType[versionByte];
    if (!didTypeAndNetwork) {
        return monet_1.Left(new Error(`Unknown address version byte ${versionByte}`));
    }
    return monet_1.Right(didTypeAndNetwork);
};
//# sourceMappingURL=did.js.map