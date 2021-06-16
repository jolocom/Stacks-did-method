export const DID_METHOD_PREFIX = "did:stacks:v2"
import BN = require("bn.js")

export const BNS_ADDRESSES = {
  main: "SP000000000000000000002Q6VF78.bns",
  test: "ST000000000000000000002AMW42H.bns",
}

export const BNS_CONTRACT_DEPLOY_TXID = {
  test: "",
  main: "d8a9a4528ae833e1894eee676af8d218f8facbf95e166472df2c1a64219b5dfb",
}

export const STX_TO_BURN = new BN(300000000000000)
