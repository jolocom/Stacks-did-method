import { identity } from "ramda"
import { fetchAndVerifySignedToken } from "./utils/signedToken"
import {
  createRejectedFuture,
  decodeFQN,
  encodeFQN,
} from "./utils/general"
import {
  parseStacksV2DID,
  buildDidDoc,
  isMigratedOnChainDid,
} from "./utils/did"
import {
  ensureZonefileMatchesName,
  parseZoneFileAndExtractNameinfo
} from "./utils/zonefile"
import { StacksV2DID } from "./types"

import {
  fetchNameInfo,
  getCurrentBlockNumber,
} from "./api"
import {
  chain,
  map,
  reject,
  resolve as fResolve,
  FutureInstance,
  promise,
} from "fluture"
import { getPublicKeyForMigratedDid } from "./migrated"
import { mapDidToBNSName } from "./utils/bns"

const getPublicKeyForDID = (
  did: StacksV2DID
): FutureInstance<Error, { publicKey: string; name: string }> =>
  //@ts-ignore Left is typed as unknown
  mapDidToBNSName(did).pipe(
    chain(({ name, namespace, subdomain, tokenUrl }) =>
      fetchAndVerifySignedToken(tokenUrl, did.address)
        .pipe(
          map(key => ({
            publicKey: key,
            name: encodeFQN({ name, namespace, subdomain }),
          }))
        )
    )
  )


const postResolve = (
  name: string,
  did: string,
  initialPubKey: string
): FutureInstance<Error, { did: string; publicKey: string }> => {
  const fqn = decodeFQN(name)

  // TODO Can subdmains be revoked? How would we find out?
  // Current assumption is that we can not easily check for this
  //
  if (fqn.subdomain) {
    return fResolve({
      did,
      publicKey: initialPubKey,
    })
  }

  return fetchNameInfo(fqn).pipe(
    chain((currentInfo) => {
      if (currentInfo.status === "name-revoke") {
        return createRejectedFuture<Error, { did: string; publicKey: string }>(
          new Error("Name bound to DID was revoked")
        )
      }

      return getCurrentBlockNumber().pipe(
        chain((currentBlock) => {
          if (currentInfo.expire_block > currentBlock) {
            return createRejectedFuture<
              Error,
              { did: string; publicKey: string }
            >(new Error("Name bound to DID expired"))
          }

          return ensureZonefileMatchesName({
            zonefile: currentInfo.zonefile,
            name: fqn.name,
            namespace: fqn.namespace,
          })
            .flatMap(parseZoneFileAndExtractNameinfo)
            .fold(reject, ({ tokenUrl }) => fetchAndVerifySignedToken(tokenUrl, currentInfo.address))
            .pipe(map( newKey  => ({
                publicKey: newKey, did
              }))
            )
        })
      )
    })
  )
}

export const resolve = (did: string) =>
  promise(
    parseStacksV2DID(did)
      .map((parsedDID) =>
        (isMigratedOnChainDid(parsedDID)
          ? getPublicKeyForMigratedDid(parsedDID)
          : getPublicKeyForDID(parsedDID)
        ).pipe(
          chain(({ name, publicKey }) =>
            postResolve(name, did, publicKey).pipe(map(buildDidDoc))
          )
        )
      )
      .fold(reject, identity)
  )
