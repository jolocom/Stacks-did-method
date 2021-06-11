import { encodeStacksV2Did } from "./did"
import { decodeFQN } from "./general"
import { fetchAllNames, fetchNameInfo, fetchZoneFileForName } from "../api"
import { None, Some } from "monet"
import { map, chain, mapRej, resolve } from "fluture"
import { map as rMap } from "ramda"

export const findValidNames =
  (onlyMigrated = false, ignoreExpired = false) =>
  (page = 0) => {
    return fetchAllNames(page).pipe(
      map(
        rMap((fqn: string) => {
          const { name, namespace } = decodeFQN(fqn)
          return fetchNameInfo({ name, namespace }).pipe(
            chain((info) => {
              if (onlyMigrated && info["last_txid"] !== "0x") {
                return resolve(None())
              }

              //@TODO 17474
              if (ignoreExpired && info.expire_block > 17474) {
                return resolve(None())
              }

              return fetchZoneFileForName({
                name,
                namespace,
                zonefileHash: info["zonefile_hash"],
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
