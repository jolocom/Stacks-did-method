import { c32ToB58 } from "c32check"
import { identity } from "ramda"
import {
  parseAndValidateTransaction,
  extractContractCallArgs,
} from "./utils/transactions"
import {
  verifyTokenAndGetPubKey,
  extractTokenFileUrl,
} from "./utils/signedToken"
import { decodeFQN, testNetAddrToMainNetAddr } from "./utils/general"
import {
  parseStacksV2DID,
  buildDidDoc,
  isMigratedOnChainDid,
  buildStacksV2DID,
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
  fork,
} from "fluture"
import { Left, Either } from "monet"

const getPublicKeyForMigratedDid = ({
  address,
  anchorTxId,
}: StacksV2DID): FutureInstance<Error, string> =>
  fetchNamesOwnedByAddress(address)
    .pipe(map((names) => names[0]))
    .pipe(map(decodeFQN))
    .pipe(chain(fetchNameInfo))
    .pipe(
      map((nameInfo): Either<Error, string> => {
        if (nameInfo.last_txid !== "0x") {
          return Left(
            new Error(
              `Verifying name-record for migrated DID failed, expected last_txid to be 0x, got ${anchorTxId}`
            )
          )
        }

        if (nameInfo.address !== address) {
          return Left(
            new Error(
              `Verifying name-record failed, expected name owner to match address, got ${address}`
            )
          )
        }

        return parseZoneFileAndExtractTokenUrl(nameInfo.zonefile, address)
      })
    )
    .pipe(chain((result) => result.fold(reject, fetchSignedToken)))
    .pipe(map(verifyTokenAndGetPubKey(testNetAddrToMainNetAddr(address))))
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
    .pipe(map(verifyTokenAndGetPubKey(testNetAddrToMainNetAddr(did.address))))
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

// fork(console.log)(console.log)(
//   resolve(
//     buildStacksV2DID(
//       "STRYYQQ9M8KAF4NS7WNZQYY59X93XEKR31JP64CP",
//       "0xb621d4cf589511eb3f563fc84c876e596c009c84d534a142c7141325064ae714"
//     )
//   )
// )
