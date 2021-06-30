"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STX_TO_BURN = exports.BNS_CONTRACT_DEPLOY_TXID = exports.BNS_ADDRESSES = exports.DID_METHOD_PREFIX = void 0;
const BN = require("bn.js");
exports.DID_METHOD_PREFIX = "did:stack:v2";
exports.BNS_ADDRESSES = {
    main: "SP000000000000000000002Q6VF78.bns",
    test: "ST000000000000000000002AMW42H.bns",
};
exports.BNS_CONTRACT_DEPLOY_TXID = {
    test: "55bb3a37f9b2e8c58905c95099d5fc21aa47d073a918f3b30cc5abe4e3be44c6",
    main: "d8a9a4528ae833e1894eee676af8d218f8facbf95e166472df2c1a64219b5dfb",
};
exports.STX_TO_BURN = new BN(300000000000000);
//# sourceMappingURL=constants.js.map