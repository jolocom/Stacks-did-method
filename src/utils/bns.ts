import { StacksNetwork } from "@stacks/network"
import { chain, map } from "fluture"
import { Either, Right } from "monet"
import { fetchTransactionById, fetchZoneFileForName } from "../api"
import { DidType, StacksV2DID } from "../types"
import { eitherToFuture } from "./general"
import { parseAndValidateTransaction } from "./transactions"
import {
  ensureZonefileMatchesName,
  findSubdomainZonefileByOwner,
  parseZoneFileAndExtractNameinfo,
} from "./zonefile"

export const mapDidToBNSName = (did: StacksV2DID, network: StacksNetwork) =>
  getZonefileForOnChainDid(did, network)
    .pipe(map(parseZoneFileAndExtractNameinfo))
    .pipe(chain(eitherToFuture))

const getZonefileForOnChainDid = (did: StacksV2DID, network: StacksNetwork) =>
  fetchTransactionById(network.coreApiUrl)(did.anchorTxId)
    .pipe(map(parseAndValidateTransaction(did)))
    .pipe(chain(eitherToFuture))
    .pipe(
      chain((nameInfo) =>
        fetchZoneFileForName(network.coreApiUrl)(nameInfo)
          .pipe(
            map(
              (
                zonefile
              ): Either<Error, { zonefile: string; subdomain?: string }> =>
                did.metadata.type === DidType.offChain
                  ? findSubdomainZonefileByOwner(zonefile, did.address)
                  : Right({
                      zonefile,
                      subdomain: undefined,
                    })
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
