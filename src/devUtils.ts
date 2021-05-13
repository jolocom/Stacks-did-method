import { decodeFQN } from "./utils"
import { fetchAllNames, fetchNameInfo, fetchZoneFile } from "./api"
import { debug } from "./registrar/utils"
import { None, Some } from "monet"
import { map, chain, mapRej } from "fluture"
import { map as rMap } from "ramda"
import { makeTestDid } from "./data"

export const findValidNames = (page = 0) => {
  return fetchAllNames(page).pipe(
    map(
      rMap((fqn: string) => {
        const { name, namespace } = decodeFQN(fqn)
        return fetchNameInfo(name, namespace).pipe(
          chain((info) => {
            // if (info["last_txid"] == "0x") {
            //     return resolve(None())
            // }

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
                        did: makeTestDid(info.address, info["last_txid"]),
                        zonefile: res,
                      })
                    : None()
                )
              )
              .pipe(map(debug("fresh")))
          })
        )
      })
    )
  )
}
