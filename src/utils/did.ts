import { DIDDocument } from "did-resolver"
import {
  DID_METHOD_PREFIX,
  BNS_CONTRACT_DEPLOY_TXID,
  versionByteToDidType,
} from "../constants"
import { DidType, StacksNetworkDeployment, StacksV2DID } from "../types"
import { stripHexPrefixIfPresent } from "./general"
import { last, split } from "ramda"
import { Right, Left, Either } from "monet"
import { c32addressDecode } from "c32check/lib/address"
const b58 = require("bs58")

export const buildDidDoc = ({
  did,
  publicKey,
}: {
  did: string
  publicKey: string
}): DIDDocument => {
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
  }
}

export const parseStacksV2DID = (did: string): Either<Error, StacksV2DID> => {
  if (!did.startsWith(DID_METHOD_PREFIX + ":")) {
    return Left(
      new Error(
        `DID "${did}" has incorrect DID method identifier, should start with ${DID_METHOD_PREFIX}`
      )
    )
  }
  const nsi = last(split(":", did))
  if (!nsi) {
    return Left(new Error(`Failed to parse DID, missing NSI`))
  }

  const [address, anchorTxId] = split("-", nsi)

  if (!address || !anchorTxId) {
    return Left(
      new Error(
        `address or txId undefined, got addr - ${address}, txId - ${anchorTxId}`
      )
    )
  }

  return getDidType(address).map((metadata) => ({
    prefix: DID_METHOD_PREFIX,
    address,
    metadata,
    anchorTxId,
  }))
}

export const encodeStacksV2Did = (did: {
  address: string
  anchorTxId: string
}) =>
  `${DID_METHOD_PREFIX}:${did.address}-${stripHexPrefixIfPresent(
    did.anchorTxId
  )}`

export const isMigratedOnChainDid = (did: string | StacksV2DID) => {
  if (typeof did === "string") {
    return parseStacksV2DID(did).map(({ anchorTxId }) => {
      Object.values(BNS_CONTRACT_DEPLOY_TXID).includes(anchorTxId)
    })
  }
  return Object.values(BNS_CONTRACT_DEPLOY_TXID).includes(did.anchorTxId)
}

/**
 * Helper function which parses a c32 encoded address and determines whether the address
 * corresponds to an on-chain DID or an off-chain DID (depending on the AddressVersion)
 */

const getDidType = (
  addr: string
): Either<Error, { type: DidType; deployment: StacksNetworkDeployment }> => {
  const [versionByte, _] = c32addressDecode(addr)
  const didTypeAndNetwork = versionByteToDidType[versionByte]

  if (!didTypeAndNetwork) {
    return Left(new Error(`Unknown address version byte ${versionByte}`))
  }

  return Right(didTypeAndNetwork)
}
