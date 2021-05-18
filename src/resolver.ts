import { c32ToB58 } from "c32check"
import { head, identity } from "ramda"
import {
  parseAndValidateTransaction,
  extractContractCallArgs,
} from "./utils/transactions"
import {
  verifyTokenAndGetPubKey,
  extractTokenFileUrl,
} from "./utils/signedToken"
import { decodeFQN } from "./utils/general"
import {
  parseStacksV2DID,
  buildDidDoc,
  isMigratedOnChainDid,
} from "./utils/did"
import {
  parseZoneFileAndExtractTokenUrl,
  getRecordsForName,
} from "./utils/zonefile"
import { StacksV2DID } from "./types"

import {
  fetchNameInfo,
  fetchNamesOwnedByAddress,
  fetchZoneFileForName,
  fetchTransactionById,
  fetchSignedToken,
} from "./api"
import {
  chain,
  map,
  reject,
  resolve as fResolve,
  FutureInstance,
} from "fluture"
import { Left } from "monet"

const getPublicKeyForMigratedDid = ({
  address,
  anchorTxId,
}: StacksV2DID): FutureInstance<Error, string> =>
  fetchNamesOwnedByAddress(address)
    .pipe(map(head))
    .pipe(map(decodeFQN))
    .pipe(chain(fetchNameInfo))
    .pipe(
      map((nameInfo) => {
        if (nameInfo.last_txid !== "0x")
          return Left(
            new Error(
              `Verifying name-record for migrated DID failed, expected last_txid to be 0x, got ${anchorTxId}`
            )
          )

        if (nameInfo.address !== address)
          return Left(
            new Error(
              `Verifying name-record failed, expected name owner to match address, got ${address}`
            )
          )

        return parseZoneFileAndExtractTokenUrl(nameInfo.zonefile, address)
      })
    )
    .pipe(chain((result) => result.fold(reject, fetchSignedToken)))
    .pipe(map(verifyTokenAndGetPubKey(c32ToB58(address))))
    .pipe(
      chain((either) =>
        either.fold<FutureInstance<Error, string>>(reject, fResolve)
      )
    )

const getPublicKeyForDID = (did: StacksV2DID): FutureInstance<Error, string> =>
  fetchTransactionById(did.anchorTxId)
    .pipe(map(parseAndValidateTransaction))
    .pipe(map((tx) => tx.chain(extractContractCallArgs)))
    .pipe(
      chain((result) =>
        result.fold(reject, (callArgs) =>
          fetchZoneFileForName(callArgs)
            .pipe(
              map(
                getRecordsForName({
                  ...callArgs,
                  owner: did.address,
                })
              )
            )
            .pipe(
              chain((zonefile) =>
                zonefile
                  .flatMap(extractTokenFileUrl)
                  .fold(reject, fetchSignedToken)
              )
            )
        )
      )
    )
    .pipe(map(verifyTokenAndGetPubKey(c32ToB58(did.address))))
    .pipe(
      chain((either) =>
        either.fold<FutureInstance<Error, string>>(reject, fResolve)
      )
    )

export const resolve = (did: string) =>
  parseStacksV2DID(did)
    .map((parsedDID) =>
      (isMigratedOnChainDid(parsedDID)
        ? getPublicKeyForMigratedDid(parsedDID)
        : getPublicKeyForDID(parsedDID)
      ).pipe(map(buildDidDoc(did)))
    )
    .fold(reject, identity)

// Does the address still own the name assigned to it at registration?
// Ensures that the key has not been changed as well
// TODO May have to account for key rotation
// export const isDidStillActive = (
//   { name, subdomain, ownerAddress, namespace, publicKeyHex }: NameRecord,
//   currentZoneFile: string
// ) => {
//   const parsedZoneFile = parseZoneFile(currentZoneFile)
//
//   if (!parsedZoneFile) {
//     return Left(
//       new Error(
//         `Failed to parse current zonefile, received content - ${currentZoneFile}`
//       )
//     )
//   }
//
//   return getRecordsForName(
//     {
//       name,
//       namespace,
//       subdomain,
//       owner: ownerAddress,
//     },
//     currentZoneFile
//   )
//     .map(parseZoneFile)
//     .map(extractTokenFileUrl)
//     .cata(reject, fetchSignedToken)
//     .pipe(chain(fetchSignedToken))
//     .pipe(chain(curry(flip(verifyProfileToken))(ownerAddress)))
//     .pipe(map((v) => v["payload"]["subject"].publicKey === publicKeyHex))
// }
