import { decodeFQN, buildStacksV2DID } from "../utils"
import { fetchAllNames, fetchNameInfo, fetchZoneFile } from "../api"
import { None, Some } from "monet"
import { map, chain, mapRej, resolve } from "fluture"
import { map as rMap } from "ramda"

export const findValidNames = (ignoreMigrated = false) => (page = 0) => {
  return fetchAllNames(page).pipe(
    map(
      rMap((fqn: string) => {
        const { name, namespace } = decodeFQN(fqn)
        return fetchNameInfo(name, namespace).pipe(
          chain((info) => {
            if (ignoreMigrated && info["last_txid"] == "0x") {
                return resolve(None())
            }

            return fetchZoneFile({
              name,
              namespace,
              zonefileHash: info["zonefile_hash"],
            })
              .pipe(mapRej(() => None()))
              .pipe(
                map((res) =>
                  res
                    ? Some({
                        did: buildStacksV2DID(info.address, info["last_txid"]),
                        zonefile: res,
                      })
                    : None()
                )
              )
              // .pipe(map((v) => debug("new entry")(v.orNull())))
          })
        )
      })
    )
  )
}

export const debug =
  (prefix: string) =>
  <T>(arg: T): T => {
    console.log(prefix && prefix + "-", { arg })
    return arg
  }
