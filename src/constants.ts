export const DID_METHOD_PREFIX = "did:stack:v2"

/*
 * If a subdomain has been transferred to this address (i.e. it is listed as the current owner),
 * it is considered revoked (the derived DID is therefore considered deactivated).
 */

export const SUBDOMAIN_REVOKED_ADDR = '1111111111111111111114oLvT2'

export const BNS_ADDRESSES = {
  main: "SP000000000000000000002Q6VF78.bns",
  test: "ST000000000000000000002AMW42H.bns",
}

/*
 * The ID of the Stacks transaction in which the BNS contract was deployed.
 * Used to represent DIDs based on migrated BNS names
 * @see - https://github.com/jolocom/stacks-did-resolver/blob/main/docs/DID_Method_Spec.md#35-migration-from-legacy-stack-v1-dids
 */
export const BNS_CONTRACT_DEPLOY_TXID = {
  test: "55bb3a37f9b2e8c58905c95099d5fc21aa47d073a918f3b30cc5abe4e3be44c6",
  main: "d8a9a4528ae833e1894eee676af8d218f8facbf95e166472df2c1a64219b5dfb",
}

/*
 * Version byte used to denote off-chain addresses. Relevant for off-chain DIDs
 */
export const OFF_CHAIN_ADDR_VERSION = 0
