import { chain, map } from "fluture"
import { Right } from "monet"
import { fetchTransactionById, fetchZoneFileForName } from "../api"
import { StacksV2DID } from "../types"
import { eitherToFuture } from "./general"
import { parseAndValidateTransaction } from "./transactions"
import {
  ensureZonefileMatchesName,
  findSubdomainZonefile,
  parseZoneFileAndExtractNameinfo,
} from "./zonefile"

export const mapDidToBNSName = (did: StacksV2DID) =>
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
