import "isomorphic-fetch"
import { prop } from "ramda"
import { encaseP, chain, map } from "fluture"
import { encodeFQN } from "./utils"

const fetchJSON = (endpoint: string) =>
  encaseP(fetch)(endpoint).pipe(chain(encaseP((res) => res.json())))

export const fetchZoneFile = (args: {
  name: string
  namespace: string
  zonefileHash?: string
}) => {
  const fullName = encodeFQN(args.name, args.namespace)
  const endpoint = `https://stacks-node-api.mainnet.stacks.co/v1/names/${fullName}/zonefile/${args.zonefileHash}`
  return fetchJSON(endpoint).pipe(map(prop("zonefile")))
}

export const fetchNamesForAddress = (address: string, chain = "stacks") => {
  return fetchJSON(
    `https://stacks-node-api.mainnet.stacks.co/v1/addresses/${chain}/${address}`
  ).pipe(map(prop("names")))
}

export const fetchNameInfo = (name: string, namespace: string) => {
  const endpoint = `https://stacks-node-api.mainnet.stacks.co/v1/names/${encodeFQN(
    name,
    namespace
  )}`
  return fetchJSON(endpoint)
}

export const fetchTransaction = (txId: string) => {
  const endpoint = `https://stacks-node-api.mainnet.stacks.co/extended/v1/tx/${txId}?event_offset=0&event_limit=96`
  return fetchJSON(endpoint)
}

export const fetchSignedToken = (endpoint: string) => {
  return fetchJSON(endpoint)
}

export const fetchAllNames = (page = 0) => {
  return fetchJSON(
    `https://stacks-node-api.mainnet.stacks.co/v1/names?page=${page}`
  )
}
