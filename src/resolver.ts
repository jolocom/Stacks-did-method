import { identity } from "ramda"
import { parseAndValidateTransaction } from "./utils/transactions"
import { verifyTokenAndGetPubKey } from "./utils/signedToken"
import { decodeFQN, encodeFQN, normalizeAddress } from "./utils/general"
import {
  parseStacksV2DID,
  buildDidDoc,
  isMigratedOnChainDid,
} from "./utils/did"
import {
  getZonefileRecordsForName,
  parseZoneFileAndExtractNameinfo,
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
  promise,
} from "fluture"

const getPublicKeyForMigratedDid = ({ address, anchorTxId }: StacksV2DID) =>
  fetchNamesOwnedByAddress(address)
    .pipe(map((names) => names[0]))
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

        return parseZoneFileAndExtractNameinfo(address)(nameInfo.zonefile)
          .map((nameInfo) =>
            fetchSignedToken(nameInfo.tokenUrl)
              .pipe(
                map(verifyTokenAndGetPubKey(normalizeAddress(nameInfo.owner)))
              )
              .pipe(
                map((key) =>
                  key.map((k) => ({
                    name: encodeFQN(nameInfo),
                    publicKey: k,
                  }))
                )
              )
              .pipe(
                chain((e) =>
                  e.fold(
                    reject,
                    (v) =>
                      fResolve(v) as FutureInstance<
                        Error,
                        { name: string; publicKey: string }
                      >
                  )
                )
              )
          )
          .fold(reject, identity)
      })
    )

const getPublicKeyForDID = (did: StacksV2DID) =>
  fetchTransactionById(did.anchorTxId).pipe(
    chain((tx) =>
      parseAndValidateTransaction(tx)
        .map(({ name, namespace, zonefileHash }) =>
          fetchZoneFileForName({ name, namespace, zonefileHash })
            .pipe(
              map(
                getZonefileRecordsForName({
                  owner: did.address,
                  name,
                  namespace,
                })
              )
            )
            .pipe(
              map((zf) =>
                zf.flatMap(parseZoneFileAndExtractNameinfo(did.address))
              )
            )
            .pipe(
              map((zf) =>
                zf.map(({ tokenUrl, namespace, name, subdomain }) =>
                  fetchSignedToken(tokenUrl)
                    .pipe(
                      map(
                        verifyTokenAndGetPubKey(normalizeAddress(did.address))
                      )
                    )
                    .pipe(
                      map((key) =>
                        key.map((k) => ({
                          name: encodeFQN({ name, namespace, subdomain }),
                          publicKey: k,
                        }))
                      )
                    )
                )
              )
            )
            .pipe(chain((p) => p.fold(reject, identity)))
        )
        .fold(reject, identity)
        .pipe(
          chain((res) =>
            res.fold(
              reject,
              (v) =>
                fResolve(v) as FutureInstance<
                  Error,
                  { name: string; publicKey: string }
                >
            )
          )
        )
    )
  )

// For on-chain names -
// 1. Name revoked
// 2 name expired / not active?

const isDidRevoked = ({ did, name }: { name: string; did: string }) => {
  const fqn = decodeFQN(name)
  // TODO
  if (fqn.subdomain) {
    return fResolve({
      revoked: false,
      did,
    })
  }

  return fetchNameInfo(fqn).pipe(
    map((currentInfo) => {
      if (currentInfo.status === "name-revoke") {
        return {
          revoked: true,
          did,
        }
      }

      return {
        revoked: false,
        did,
      }
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
            isDidRevoked({ name, did }).pipe(
              chain(({ did, revoked }) =>
                revoked
                  ? reject(new Error("DID Revoked"))
                  : fResolve(buildDidDoc(did)(publicKey))
              )
            )
          )
        )
      )
      .fold(reject, identity)
  )
