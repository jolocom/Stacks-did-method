import "isomorphic-fetch"
import { prop } from "ramda"
import {
  encaseP,
  map,
  resolve,
  chain,
  reject,
  FutureInstance,
  fork,
} from "fluture"
import { encodeFQN, stripHexPrefixIfPresent } from "./utils/general"
import { BNS_ADDRESSES } from "./constants"
import {
  addressToString,
  bufferCVFromString,
  callReadOnlyFunction,
  ClarityAbiTypeTuple,
  cvToJSON,
  hexToCV,
  parseToCV,
  ReadOnlyFunctionOptions,
  serializeCV,
  TupleCV,
  tupleCV,
} from "@stacks/transactions"
import { StacksMocknet, StacksNetwork } from "@stacks/network"
import { principalCV } from "@stacks/transactions/dist/clarity/types/principalCV"

const HOST = "http://localhost:3999"
// const HOST = 'https://stacks-node-api.mainnet.stacks.co'

const postJSON = <T>(endpoint: string, data: {}): FutureInstance<Error, T> => {
  return encaseP<Error, T, string>(() =>
    fetch(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    }).then((res) => res.json())
  )(endpoint)
}

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
  const fullName = encodeFQN({ name: args.name, namespace: args.namespace })

  const endpoint = `${HOST}/v1/names/${fullName}/zonefile/${
    args.zonefileHash || ""
  }`
  return fetchJSON<{ zonefile: string }>(endpoint).pipe(map(prop("zonefile")))
}

export const fetchNamesOwnedByAddress = (
  address: string,
  blockChain = "stacks"
): FutureInstance<Error, string[]> => {
  return fetchJSON<{ names: string[] }>(
    `${HOST}/v1/addresses/${blockChain}/${address}`
  )
    .pipe(map(prop("names")))
    .pipe(
      chain((names) =>
        names?.length > 0
          ? resolve(names)
          : reject(new Error("No names associated with DID"))
      )
    )
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
  const endpoint = `${HOST}/v1/names/${encodeFQN({ name, namespace })}`

  return fetchJSON<NameInfo>(endpoint).pipe(
    chain((res) => {
      return fetchNameInfoFromContract({
        name,
        namespace,
        network: new StacksMocknet(),
      }).pipe(
        map(({ address, zonefile_hash }) => {
          if (
            stripHexPrefixIfPresent(zonefile_hash) ===
            stripHexPrefixIfPresent(res.zonefile_hash)
          ) {
            return {
              ...res,
              address,
            }
          }
          return res
        })
      )
    })
  )
}

export const fetchNameInfoFromContract = ({
  name,
  namespace,
  network,
}: {
  name: string
  namespace: string
  network: StacksNetwork
}): FutureInstance<Error, { zonefile_hash: string; address: string }> => {
  const [contractAddress, contractName] = BNS_ADDRESSES.test.split(".")

  const functionName = "name-resolve"
  const senderAddress = "ST2F4BK4GZH6YFBNHYDDGN4T1RKBA7DA1BJZPJEJJ"

  const options = {
    contractAddress,
    contractName,
    functionName,
    functionArgs: [bufferCVFromString(namespace), bufferCVFromString(name)],
    network,
    senderAddress,
  }

  //@ts-ignore
  return encaseP(callReadOnlyFunction)(options).pipe(
    chain((v) => {
      const { value, success } = cvToJSON(v)
      if (!success) {
        return reject("Failed to read name info from chain")
      }

      return resolve({
        zonefile_hash: value.value["zonefile-hash"].value as string,
        address: value.value.owner.value,
      })
    })
  )
}

type TxStatus =
  | "success"
  | "abort_by_response"
  | "abort_by_post_condition"
  | "pending"

export const fetchTransactionById = (txId: string) => {
  const endpoint = `${HOST}/extended/v1/tx/${txId}?event_offset=0&event_limit=96`
  return fetchJSON<{ tx_id: string; tx_status: TxStatus }>(endpoint).pipe(
    chain((res) => {
      if (res.tx_id && res.tx_status) {
        return resolve(res)
      }
      return reject(new Error((res as any).error))
    })
  )
}

export const fetchSignedToken = (endpoint: string) => {
  return fetchJSON<any[]>(endpoint).pipe(map((el) => el[0]))
}

export const fetchAllNames = (page = 0) => {
  return fetchJSON<string[]>(`${HOST}/v1/names?page=${page}`)
}

export const getCurrentBlockNumber = () => {
  return fetchJSON<{ stacks_tip_height: number }>(`${HOST}/v2/info`).pipe(
    map(prop("stacks_tip_height"))
  )
}
