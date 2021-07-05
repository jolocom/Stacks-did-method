"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.versionByteToDidType = exports.OffChainAddressVersion = exports.BNS_CONTRACT_DEPLOY_TXID = exports.BNS_ADDRESSES = exports.SUBDOMAIN_REVOKED_ADDR = exports.DID_METHOD_PREFIX = void 0;
const transactions_1 = require("@stacks/transactions");
const types_1 = require("./types");
exports.DID_METHOD_PREFIX = "did:stack:v2";
/*
 * If a subdomain has been transferred to this address (i.e. it is listed as the current owner),
 * it is considered revoked (the derived DID is therefore considered deactivated).
 */
exports.SUBDOMAIN_REVOKED_ADDR = '1111111111111111111114oLvT2';
exports.BNS_ADDRESSES = {
    main: "SP000000000000000000002Q6VF78.bns",
    test: "ST000000000000000000002AMW42H.bns",
};
/*
 * The ID of the Stacks transaction in which the BNS contract was deployed.
 * Used to represent DIDs based on migrated BNS names
 * @see - https://github.com/jolocom/stacks-did-resolver/blob/main/docs/DID_Method_Spec.md#35-migration-from-legacy-stack-v1-dids
 */
exports.BNS_CONTRACT_DEPLOY_TXID = {
    test: "55bb3a37f9b2e8c58905c95099d5fc21aa47d073a918f3b30cc5abe4e3be44c6",
    main: "d8a9a4528ae833e1894eee676af8d218f8facbf95e166472df2c1a64219b5dfb",
};
/*
 * Version byte used to denote off-chain DIDs. As documented here:
 * @see https://github.com/jolocom/stacks-did-resolver/blob/main/docs/DID_Method_Spec.md#22-address-encoding
 */
exports.OffChainAddressVersion = {
    mainnet: 17,
    testnet: 18
};
exports.versionByteToDidType = {
    [transactions_1.AddressVersion.MainnetSingleSig]: {
        type: types_1.DidType.onChain,
        deployment: types_1.StacksNetworkDeployment.main
    },
    [transactions_1.AddressVersion.TestnetSingleSig]: {
        type: types_1.DidType.onChain,
        deployment: types_1.StacksNetworkDeployment.test
    },
    [exports.OffChainAddressVersion.mainnet]: {
        type: types_1.DidType.offChain,
        deployment: types_1.StacksNetworkDeployment.main
    },
    [exports.OffChainAddressVersion.testnet]: {
        type: types_1.DidType.offChain,
        deployment: types_1.StacksNetworkDeployment.test
    }
};
//# sourceMappingURL=constants.js.map