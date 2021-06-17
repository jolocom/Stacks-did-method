import { identity } from "ramda"
import {
  decodeFQN,
  encodeFQN,
} from "./utils/general"
import {
  getPublicKeyUsingZoneFile,
  parseZoneFileAndExtractNameinfo
} from "./utils/zonefile"
import { StacksV2DID } from "./types"

import {
  fetchNameInfo,
  fetchNamesOwnedByAddress,
} from "./api"
import {
  chain,
  map,
  reject,
} from "fluture"

export const getPublicKeyForMigratedDid = ({ address, anchorTxId }: StacksV2DID) =>
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
          .map(({ name, namespace, subdomain }) =>
               getPublicKeyUsingZoneFile(nameInfo.zonefile, nameInfo.address)
              .pipe(
                map((key) => ({
                    name: encodeFQN({
                      name,
                      namespace,
                      subdomain,
                    }),
                    publicKey: key,
                }))
              )
          )
          .fold(reject, identity)
      })
    )

