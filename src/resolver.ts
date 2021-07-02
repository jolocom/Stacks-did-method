import { identity } from "ramda"
import { fetchAndVerifySignedToken } from "./utils/signedToken"
import {
  createRejectedFuture,
  decodeFQN,
  eitherToFuture,
  encodeFQN,
} from "./utils/general"
import {
  parseStacksV2DID,
  buildDidDoc,
  isMigratedOnChainDid,
} from "./utils/did"
import {
  ensureZonefileMatchesName,
  findSubdomainZoneFileByName,
  parseZoneFileAndExtractNameinfo,
} from "./utils/zonefile"
import { StacksV2DID } from "./types"

import { fetchNameInfo, getCurrentBlockNumber } from "./api"
import {
  chain,
  map,
  resolve as fResolve,
  FutureInstance,
  promise,
  mapRej,
} from "fluture"
import { getPublicKeyForMigratedDid } from "./migrated"
import { mapDidToBNSName } from "./utils/bns"
import { Either, Right } from "monet"
import { DIDDocument } from "did-resolver"
import { StacksMainnet, StacksNetwork } from "@stacks/network"

const getPublicKeyForDID = (
  did: StacksV2DID,
  network: StacksNetwork
): FutureInstance<Error, { publicKey: string; name: string }> =>
  //@ts-ignore
  mapDidToBNSName(did, network).pipe(
    chain(({ name, namespace, subdomain, tokenUrl }) =>
      fetchAndVerifySignedToken(tokenUrl, did.address).pipe(
        map((key) => ({
          publicKey: key,
          name: encodeFQN({ name, namespace, subdomain }),
        }))
      )
    )
  )

const postResolve = (
  name: string,
  did: string,
  network: StacksNetwork
): FutureInstance<Error, { did: string; publicKey: string }> => {
  const fqn = decodeFQN(name)

  return fetchNameInfo(network)(fqn).pipe(
    chain((currentInfo) => {
      if (currentInfo.status === "name-revoke") {
        return createRejectedFuture<Error, { did: string; publicKey: string }>(
          new Error("Name bound to DID was revoked")
        )
      }

      return getCurrentBlockNumber(network.coreApiUrl)
        .pipe(
          chain((currentBlock) => {
            if (currentInfo.expire_block > currentBlock) {
              return createRejectedFuture<Error, boolean>(
                new Error("Name bound to DID expired")
              )
            }
            return fResolve(true)
          })
        )
        .pipe(
          map(() =>
            fqn.subdomain
              ? findSubdomainZoneFileByName(currentInfo.zonefile, fqn.subdomain)
              : (Right({
                  zonefile: currentInfo.zonefile,
                  subdomain: undefined,
                  owner: currentInfo.address,
                }) as Either<
                  Error,
                  { zonefile: string; subdomain: undefined; owner: string }
                >)
          )
        )
        .pipe(
          map((v) =>
            v.flatMap(({ zonefile, subdomain, owner }) => {
              return ensureZonefileMatchesName({
                zonefile,
                name: fqn.name,
                namespace: fqn.namespace,
                subdomain,
              })
                .flatMap(parseZoneFileAndExtractNameinfo)
                .map((nameInfo) => ({ ...nameInfo, owner }))
            })
          )
        )
        .pipe(chain((eith) => eitherToFuture(eith)))
        .pipe(
          chain(({ tokenUrl, owner }) =>
            fetchAndVerifySignedToken(tokenUrl, owner)
          )
        )
        .pipe(
          mapRej(
            (err) =>
              new Error(
                `PostResolution: failed to fetch latest public key, error: ${err.message}`
              )
          )
        )
        .pipe(map((publicKey) => ({ publicKey, did })))
    })
  )
}

export const getResolver = (
  stacksNetwork: StacksNetwork = new StacksMainnet()
) => {
  const resolve = (did: string) =>
    promise(
      parseStacksV2DID(did)
        .map((parsedDID) =>
          (isMigratedOnChainDid(parsedDID)
            ? getPublicKeyForMigratedDid(parsedDID, stacksNetwork)
            : getPublicKeyForDID(parsedDID, stacksNetwork)
          ).pipe(
            chain(({ name }) =>
              postResolve(name, did, stacksNetwork).pipe(map(buildDidDoc))
            )
          )
        )
        .fold((e) => createRejectedFuture<Error, DIDDocument>(e), identity)
    )

  // @TODO integrate with DID resolver
  return resolve
}
