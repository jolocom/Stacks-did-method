import { encodeStacksV2Did } from "./did/did"
import { decodeFQN, eitherToFuture } from "./general"
import { fetchAllNames, fetchNameInfo, fetchZoneFileForName } from "../api"
import { None, Some } from "monet"
import { map, chain, mapRej, resolve } from "fluture"
import { map as rMap } from "ramda"
import { StacksNetwork } from "@stacks/network"

export const findValidNames =
  (network: StacksNetwork, onlyMigrated = false) =>
  (page = 0) => {
    return fetchAllNames(network.coreApiUrl)(page).pipe(
      map(
        rMap((fqn: string) => {
          eitherToFuture(decodeFQN(fqn)).pipe(
            chain(({ name, namespace }) =>
              fetchNameInfo(network)({ name, namespace }).pipe(
                chain((info) => {
                  if (onlyMigrated && info["last_txid"] !== "0x") {
                    return resolve(None())
                  }

                  return fetchZoneFileForName(network.coreApiUrl)({
                    name,
                    namespace,
                  })
                    .pipe(mapRej(() => None()))
                    .pipe(
                      map((res) =>
                        res
                          ? Some({
                              did: encodeStacksV2Did({
                                address: info.address,
                                anchorTxId: info["last_txid"],
                              }),
                              zonefile: res,
                            })
                          : None()
                      )
                    )
                    .pipe(map((v) => debug("new entry")(v.orNull())))
                })
              )
            )
          )
        })
      )
    )
  }

export const debug =
  (prefix: string) =>
  <T>(arg: T): T => {
    console.log(prefix && prefix + "-", arg)
    return arg
  }
