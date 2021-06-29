import "isomorphic-fetch"
import { identity, prop } from "ramda"
import {
  encaseP,
  map,
  resolve,
  chain,
  reject,
  FutureInstance,
} from "fluture"
import { encodeFQN, stripHexPrefixIfPresent } from "./utils/general"
import { BNS_ADDRESSES } from "./constants"
import {
  bufferCVFromString,
  callReadOnlyFunction,
  ClarityValue,
  ReadOnlyFunctionOptions,
  cvToJSON,
} from "@stacks/transactions"
import { StacksMocknet, StacksNetwork } from "@stacks/network"
import { Maybe, None, Some } from "monet"

const fetchJSON = <T>(endpoint: string): FutureInstance<Error, T> => {
  return encaseP<Error, T, string>(() =>
    fetch(endpoint).then((res) => res.json() as Promise<T>)
  )(endpoint)
}

/**
 * Given a on-chain BNS name, will return the latest zonefile associated with it.
 * @param {String} name - the BNS name for which the zonefile will be retrieved
 * @param {String} namespace - the BNS namespace to which the BNS name belongs
 *
 * @returns {FutureInstance<Error ,String>} which resolves to the zonefile, as a string
 */

export const fetchZoneFileForName =  (apiEndpoint: string) => (args: {
  name: string
  namespace: string
  zonefileHash?: string
}): FutureInstance<Error, string> => {
  const fqn = encodeFQN({ name: args.name, namespace: args.namespace })
  const endpoint = `${apiEndpoint}/v1/names/${fqn}/zonefile/${
    args.zonefileHash || ""
  }`

  return fetchJSON<{ zonefile: string }>(endpoint).pipe(map(prop("zonefile")))
}

/**
 * Given a Stacks Address, will return an array of BNS names owned by it.
 * @param {String} address - a c32 encoded Stacks Address
 *
 * @returns {FutureInstance<Error, String[]>} - an array of names owned by the address.
 */

export const fetchNamesOwnedByAddress = (apiEndpoint: string) => (
  address: string,
): FutureInstance<Error, string[]> =>
  fetchJSON<{ names: string[] }>(
    `${apiEndpoint}/v1/addresses/stacks/${address}`
  )
    .pipe(map(prop("names")))
    .pipe(
      chain((names) =>
        names?.length > 0
          ? resolve(names)
          : reject(new Error("No names associated with DID"))
      )
    )

type NameInfo = {
  address: string
  blockchain: string
  expire_block: number
  last_txid: string
  status: string
  zonefile: string
  zonefile_hash: string
}

/**
 * Will query a Stacks node for the latest state associated with a BNS name
 * @param {String} name - the BNS name for which the zonefile will be retrieved
 * @param {String} namespace - the BNS namespace to which the BNS name belongs
 *
 * @returns {NameInfo} - the name state received from the BNS contract / Stacks node
 */

export const fetchNameInfo = (apiEndpoint: string) => ({
  name,
  namespace,
}: {
  name: string
  namespace: string
}): FutureInstance<Error, NameInfo> => {
  const endpoint = `${apiEndpoint}/v1/names/${encodeFQN({ name, namespace })}`

  return fetchJSON<NameInfo>(endpoint).pipe(
    chain((res) => {
      return fetchNameInfoFromContract({
        name,
        namespace,
        network: new StacksMocknet(),
      }).pipe(map(
        someResult =>
          someResult.map(({ address, zonefile_hash }) => {
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
          }).cata(() => res, identity)
        )
      )
    })
  )
}

type NameResolveResult = {
  zonefile_hash: string,
  address: string
}

/**
 * Will query a the BNS contract directly for the latest state associated with a BNS name
 * @param {String} name - the BNS name for which the state should be retrieved
 * @param {String} namespace - the BNS namespace to which the BNS name belongs
 * @param {StacksNetwork} network - the Stacks deployment / network to use
 *
 * @returns {Maybe<NameInfo>} - the name state received from the BNS contract / Stacks node
 */

const fetchNameInfoFromContract = ({
  name,
  namespace,
  network,
}: {
  name: string
  namespace: string
  network: StacksNetwork
}): FutureInstance<Error, Maybe<NameResolveResult>> => {
  const [contractAddress, contractName] = BNS_ADDRESSES.test.split(".")

  // TODO Use randomly generated addr every time?
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

  return encaseP<Error, ClarityValue, ReadOnlyFunctionOptions>(callReadOnlyFunction)(options).pipe(
    chain((result) => {
      const { value, success } = cvToJSON(result)
      if (!success) {
        return resolve(None())
      }

      return resolve(Some({
        zonefile_hash: value.value["zonefile-hash"].value as string,
        address: value.value.owner.value,
      }))
    })
  )
}

type TxStatus =
  | "success"
  | "abort_by_response"
  | "abort_by_post_condition"
  | "pending"

/**
 * Given a Stacks transaction ID, will attempt to retrieve the corresponding transaction
 * from a Stacks blockchain node
 * @param {String} txId - the Stacks transaction identifier
 *
 * @returns the corresponding stacks transaction if found
 */

export const fetchTransactionById = (apiEndpoint: string) => (txId: string) => {
  const endpoint = `${apiEndpoint}/extended/v1/tx/${txId}?event_offset=0&event_limit=96`
  return fetchJSON<{ tx_id: string; tx_status: TxStatus }>(endpoint).pipe(
    chain((res) => {
      if (res.tx_id && res.tx_status) {
        return resolve(res)
      }
      return reject(new Error((res as any).error))
    })
  )
}

export const fetchSignedToken = (endpoint: string) => 
  fetchJSON<any[]>(endpoint).pipe(map((el) => el[0]))

export const fetchAllNames =(apiEndpoint: string) => (page = 0) =>
  fetchJSON<string[]>(`${apiEndpoint}/v1/names?page=${page}`)

export const getCurrentBlockNumber = (apiEndpoint: string) =>
  fetchJSON<{ stacks_tip_height: number }>(`${apiEndpoint}/v2/info`).pipe(
    map(prop("stacks_tip_height"))
  )
