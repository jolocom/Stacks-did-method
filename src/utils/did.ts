import { DIDDocument } from "did-resolver"
import { DID_METHOD_PREFIX, BNS_CONTRACT_DEPLOY_TXID } from "../constants"
import { StacksV2DID } from "../types"
import { stripHexPrefixIfPresent } from "./general"
import { last, split } from "ramda"
import { Right, Left, Either } from "monet"
import {
  getZonefileRecordsForName,
  parseZoneFileAndExtractNameinfo,
  parseZoneFileAndExtractTokenUrl,
} from "./zonefile"
const b58 = require("bs58")

export const buildDidDoc =
  (did: string) =>
  (publicKey: string): DIDDocument => {
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

  return Right({
    prefix: DID_METHOD_PREFIX,
    address,
    anchorTxId,
  })
}

export const isMigratedOnChainDid = (did: string | StacksV2DID) => {
  if (typeof did === "string") {
    return parseStacksV2DID(did).map(({ anchorTxId }) => {
      Object.values(BNS_CONTRACT_DEPLOY_TXID).includes(anchorTxId)
    })
  }
  return Object.values(BNS_CONTRACT_DEPLOY_TXID).includes(did.anchorTxId)
}

export const encodeStacksV2Did = (did: Omit<StacksV2DID, "prefix">) =>
  `${DID_METHOD_PREFIX}:${did.address}-${stripHexPrefixIfPresent(
    did.anchorTxId
  )}`

// @TODO Should establish the key and the address match
// export const mapDidToName = (
//   did: StacksV2DID
// ): FutureInstance<Error, string> => {
//   if (isMigratedOnChainDid(did)) {
//     return fetchNamesOwnedByAddress(encodeStacksV2Did(did)).pipe(
//       map((names) => names[0])
//     )
//   } else {
//     return fetchTransactionById(did.anchorTxId)
//       .pipe(map(parseAndValidateTransaction))
//       .pipe(
//         chain((txEither) =>
//           txEither.fold(reject, (nameInfo) =>
//             fetchZoneFileForName(nameInfo).pipe(
//               map(
//                 getZonefileRecordsForName({ ...nameInfo, owner: did.address })
//               )
//             )
//           )
//         )
//       )
//       .pipe(
//         map((zfEither) =>
//           zfEither
//             .flatMap(parseZoneFileAndExtractNameinfo(did.address))
//             .map(encodeFQN)
//         )
//       )
//       .pipe(
//         chain((e) =>
//           e.fold(reject, (fqn) => resolve(fqn) as FutureInstance<Error, string>)
//         )
//       )
//   }
// }
