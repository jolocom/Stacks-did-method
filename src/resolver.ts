import { identity } from "ramda"
import { parseAndValidateTransaction } from "./utils/transactions"
import { verifyTokenAndGetPubKey } from "./utils/signedToken"
import {
  createRejectedFuture,
  decodeFQN,
  eitherToFuture,
  normalizeAddress,
  encodeFQN,
} from "./utils/general"
import {
  parseStacksV2DID,
  buildDidDoc,
  isMigratedOnChainDid,
} from "./utils/did"
import {
  ensureZonefileMatchesName,
  findSubdomainZonefile,
  parseZoneFileAndExtractNameinfo,
} from "./utils/zonefile"
import { StacksV2DID } from "./types"

import {
  fetchNameInfo,
  fetchNamesOwnedByAddress,
  fetchZoneFileForName,
  fetchTransactionById,
  fetchSignedToken,
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
import { Right } from "monet"

const getPublicKeyForMigratedDid = ({ address, anchorTxId }: StacksV2DID) =>
  fetchNamesOwnedByAddress(address)
    .pipe(map((names) => names[0])) // One principal can only map to one on-chain name, therefore we don't expect to receive multiple results here
    .pipe(map(decodeFQN))
    .pipe(chain(fetchNameInfo))
    .pipe(
      chain((nameInfo) => {
        if (
          nameInfo.last_txid === "0x" &&
          nameInfo.status !== "name-register"
        ) {
          // TODO What if a migrated name has since been updated? How do we handle this case?
          return reject(
            new Error(
              `Verifying name-record for migrated DID failed, expected last_txid to be 0x, got ${anchorTxId}`
            )
          )
        }

        if (nameInfo.address !== address) {
          return reject(
            new Error(
              `Verifying name-record failed, expected name owner to match address, got ${address}`
            )
          )
        }

        return parseZoneFileAndExtractNameinfo(nameInfo.zonefile)
          .map(({ tokenUrl, name, namespace, subdomain }) =>
            fetchSignedToken(tokenUrl)
              .pipe(
                map(verifyTokenAndGetPubKey(normalizeAddress(nameInfo.address)))
              )
              .pipe(
                map((key) =>
                  key.map((k) => ({
                    name: encodeFQN({
                      name,
                      namespace,
                      subdomain,
                    }),
                    publicKey: k,
                  }))
                )
              )
              .pipe(chain(eitherToFuture))
          )
          .fold(reject, identity)
      })
    )

const getPublicKeyForDID = (
  did: StacksV2DID
): FutureInstance<Error, { publicKey: string; name: string }> =>
  //@ts-ignore Typing issue with Left, not recognised as Error.
  mapDidToBNSName(did).pipe(
    chain(({ name, namespace, subdomain, tokenUrl }) =>
      fetchSignedToken(tokenUrl)
        .pipe(map(verifyTokenAndGetPubKey(normalizeAddress(did.address))))
        .pipe(
          chain((key) =>
            eitherToFuture(
              key.map((publicKey) => ({
                publicKey,
                name: encodeFQN({ name, namespace, subdomain }),
              }))
            )
          )
        )
    )
  )

const mapDidToBNSName = (did: StacksV2DID) =>
  getZonefileForDid(did)
    .pipe(map(parseZoneFileAndExtractNameinfo))
    .pipe(chain(eitherToFuture))

const getZonefileForDid = (did: StacksV2DID) =>
  fetchTransactionById(did.anchorTxId)
    .pipe(map(parseAndValidateTransaction))
    .pipe(chain(eitherToFuture))
    .pipe(
      chain(({ subdomainInception, ...nameInfo }) =>
        fetchZoneFileForName(nameInfo)
          .pipe(
            map((zonefile) =>
              subdomainInception
                ? findSubdomainZonefile(zonefile, did.address)
                : Right({
                    zonefile,
                    subdomain: undefined,
                  } as { subdomain?: string; zonefile: string })
            )
          )
          .pipe(
            chain((relevantZf) =>
              eitherToFuture(
                relevantZf.flatMap(({ subdomain, zonefile }) =>
                  ensureZonefileMatchesName({
                    name: nameInfo.name,
                    namespace: nameInfo.namespace,
                    subdomain,
                    zonefile,
                  })
                )
              )
            )
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
            .fold(reject, ({ tokenUrl }) => fetchSignedToken(tokenUrl))
            .pipe(
              map(
                verifyTokenAndGetPubKey(normalizeAddress(currentInfo.address))
              )
            )
            .pipe(
              chain((newInfo) =>
                newInfo.fold(
                  () => fResolve({ did, publicKey: initialPubKey }),
                  (newKey) => fResolve({ publicKey: newKey, did })
                )
              )
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
