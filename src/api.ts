import "isomorphic-fetch"
import { prop } from "ramda"
import { encaseP, map, FutureInstance } from "fluture"
import { encodeFQN } from "./utils/general"
import { debug } from "./utils/dev"

const HOST = "http://localhost:3999"

const fetchJSON = <T>(endpoint: string): FutureInstance<Error, T> => {
  return encaseP<Error, T, string>(() =>
    fetch(endpoint).then((res) => res.json() as Promise<T>)
  )(endpoint)
}

export const fetchZoneFileForName = (args: {
  name: string
  namespace: string
  zonefileHash?: string
}) => {
  const fullName = encodeFQN(args.name, args.namespace)

  const endpoint = `${HOST}/v1/names/${fullName}/zonefile/${args.zonefileHash}`
  return fetchJSON<{ zonefile: string }>(endpoint).pipe(map(prop("zonefile")))
}

export const fetchNamesOwnedByAddress = (
  address: string,
  chain = "stacks"
): FutureInstance<Error, string[]> => {
  console.log(`${HOST}/v1/addresses/${chain}/${address}`)
  return fetchJSON<{ names: string[] }>(
    `${HOST}/v1/addresses/${chain}/${address}`
  ).pipe(map(prop("names")))
}

type NameInfo = {
  address: string
  blockchain: string
  expire_block: number
  last_txid: string
  status: string
  zonefile: string
  zonefile_hash: string
}
export const fetchNameInfo = ({
  name,
  namespace,
}: {
  name: string
  namespace: string
}): FutureInstance<Error, NameInfo> => {
  const endpoint = `${HOST}/v1/names/${encodeFQN(name, namespace)}`
  return fetchJSON(endpoint)
}

type TxStatus =
  | "success"
  | "abort_by_response"
  | "abort_by_post_condition"
  | "pending"

export const fetchTransactionById = (txId: string) => {
  const endpoint = `${HOST}/extended/v1/tx/${txId}?event_offset=0&event_limit=96`
  return fetchJSON<{ tx_id: string; tx_status: TxStatus }>(endpoint)
}

export const fetchSignedToken = (endpoint: string) => {
  console.log(endpoint)
  return fetchJSON<any[]>(endpoint).pipe(map((el) => el[0]))
}

export const fetchAllNames = (page = 0) => {
  return fetchJSON<string[]>(`${HOST}/v1/names?page=${page}`)
}
