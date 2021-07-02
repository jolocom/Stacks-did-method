import { StacksNetwork } from "@stacks/network"
import { chain, map } from "fluture"
import { Right } from "monet"
import { fetchTransactionById, fetchZoneFileForName } from "../api"
import { DidType, StacksV2DID } from "../types"
import { eitherToFuture } from "./general"
import { parseAndValidateTransaction } from "./transactions"
import {
  ensureZonefileMatchesName,
  findSubdomainZonefile,
  parseZoneFileAndExtractNameinfo,
} from "./zonefile"

export const mapDidToBNSName = (did: StacksV2DID, network: StacksNetwork) =>
  getZonefileForDid(did, network)
    .pipe(map(parseZoneFileAndExtractNameinfo))
    .pipe(chain(eitherToFuture))

const getZonefileForDid = (did: StacksV2DID, network: StacksNetwork) =>
  fetchTransactionById(network.coreApiUrl)(did.anchorTxId)
    .pipe(map(parseAndValidateTransaction(did)))
    .pipe(chain(eitherToFuture))
    .pipe(
      chain(({ ...nameInfo }) =>
        fetchZoneFileForName(network.coreApiUrl)(nameInfo)
          .pipe(
            map((zonefile) =>
              did.type === DidType.offChain
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
