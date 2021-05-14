import { c32ToB58 } from "c32check"
import { BNS_CONTRACT_NAME } from "@stacks/bns"
import { parseZoneFile } from "zone-file"
import { compose } from "ramda"
import { getTokenFileUrl, verifyProfileToken } from "@stacks/profile"
import { hexToCV, cvToValue } from "@stacks/transactions"
import {
  hexToAscii,
  stripHexPrefixIfPresent,
  encodeFQN,
  decodeFQN,
  parseStacksV2DID,
  buildDidDoc,
  parseZoneFileTXT,
} from "./utils"

import {
  fetchNameInfo,
  fetchNamesForAddress,
  fetchZoneFile,
  fetchTransaction,
  fetchSignedToken,
} from "./api"
import { chain, map, promise, FutureInstance } from "fluture"
import { BNS_ADDRESSES, BNS_CONTRACT_DEPLOY_TXID } from "./constants"

// Ensure contract address is correct - DONE
// ensure tx type is contract call - DONE
// ensure contract_call.function_sigunature / name matches - DONE

type NameRecord = {
  name: string
  namespace: string
  subdomain?: string
  ownerAddress: string
  publicKeyHex: string
}

const parseAndValidateTransaction = (txData: any) => {
  const allowedFunctionNames = ["name-register", "name-update"]
  const contractCallData = txData["contract_call"]

  if (!contractCallData) {
    throw new Error("resolve failed, no contract_call in fetched tx")
  }

  if (!Object.values(BNS_ADDRESSES).includes(contractCallData["contract_id"])) {
    throw new Error(
      "Must reference TX to the BNS contract address, mainnet or testnet"
    )
  }

  const calledFunction = contractCallData["function_name"]

  if (!allowedFunctionNames.includes(calledFunction)) {
    throw new Error(
      `call ${calledFunction} not allowed. supported methods are ${allowedFunctionNames.toString()}`
    )
  }

  return contractCallData["function_args"]
}

/**
 * Extracts the namespace, name, and zonefile-hash arguments from a name-register / name-update TX
 * @returns nameInfo - the name, namespace, and zonefile-hash encoded in the TX
 */

const extractContractCallArgs = (functionArgs: Array<any>) => {
  const relevantArguments = ["name", "namespace", "zonefile-hash"]

  const {
    name,
    namespace,
    "zonefile-hash": zonefileHash,
  } = functionArgs.reduce((parsed, current) => {
    if (relevantArguments.includes(current.name)) {
      return { ...parsed, [current.name]: current.hex }
    }
    return parsed
  }, {})

  const hexEncodedValues = [name, namespace, zonefileHash].map(
    compose(stripHexPrefixIfPresent, cvToValue, hexToCV)
  )

  return {
    name: hexToAscii(hexEncodedValues[0]),
    namespace: hexToAscii(hexEncodedValues[1]),
    zonefileHash: hexEncodedValues[2],
  }
}

// TODO Note - Currently exported for testing.
export const fetchPublicKeyFromZoneFile = ({
  zonefile,
  name,
  namespace,
  address,
  subdomain,
}: {
  zonefile: string
  name?: string
  namespace?: string
  subdomain?: string
  address: string
}): FutureInstance<{}, NameRecord> => {
  const parsedZoneFile = parseZoneFile(zonefile)

  const {
    name: originName,
    namespace: originNamespace,
    subdomain: originSubdomain,
  } = decodeFQN(parsedZoneFile["$origin"])

  if (name && namespace) {
    // We have the zonefile for our name, or for the tld
    if (name === originName && namespace === originNamespace) {
      if (originSubdomain && originSubdomain !== subdomain) {
        throw new Error("Incorrect zonefile")
      }
    }
  }

  if (address && parsedZoneFile.txt) {
    const match = parsedZoneFile.txt.find(
      ({ txt }) => parseZoneFileTXT(txt).owner === c32ToB58(address)
    )

    if (match) {
      const nestedZoneFile = Buffer.from(
        parseZoneFileTXT(match.txt).zonefile,
        "base64"
      ).toString("ascii")

      return fetchPublicKeyFromZoneFile({
        zonefile: nestedZoneFile,
        name: originName,
        namespace: originNamespace,
        subdomain: match.name,
        address,
      })
    }
  }

  return fetchSignedToken(getTokenFileUrl(parsedZoneFile))
    .pipe(map((token) => verifyProfileToken(token[0].token, c32ToB58(address))))
    .pipe(
      map(
        (res) =>
          ({
            name,
            namespace,
            subdomain: originSubdomain,
            ownerAddress: address,
            publicKeyHex: res.payload["subject"].publicKey,
          } as NameRecord)
      )
    )
}

const isMigratedDid = (did: string) => {
  const { txId } = parseStacksV2DID(did)
  return Object.values(BNS_CONTRACT_DEPLOY_TXID).includes(txId)
}

const getNameInfoForAddress = (address: string) => {
  return fetchNamesForAddress(address)
    .pipe(
      chain((names) => {
        if (Array.isArray(names) && names.length !== 1) {
          throw new Error(
            `Address expected to own exactly one on-chain name, received - ${names.toString()}`
          )
        }

        const { name, namespace } = decodeFQN(names[0])
        return fetchNameInfo(name, namespace).pipe(
          map((info) => ({ name, namespace, ...info }))
        )
      })
    )
    .pipe(
      chain((nameInfo) => {
        if (nameInfo["last_txid"] !== "0x") {
          throw new Error(
            `Verifying name-record for migrated DID failed, expected last_txid to be 0x, got ${nameInfo["last_txid"]}`
          )
        }

        if (nameInfo.address !== address) {
          throw new Error(
            `Verifying name-record failed, expected name owner to match address, got ${nameInfo.address}`
          )
        }

        return fetchPublicKeyFromZoneFile({
          zonefile: nameInfo.zonefile,
          name: nameInfo.name,
          namespace: nameInfo.namespace,
          address,
        })
      })
    )
}

export const resolve = async (did: string) => {
  const { address, txId } = parseStacksV2DID(did)

  if (!address || !txId) {
    throw new Error(`address or txId undefined, ${{ address, txId }}`)
  }

  const resolvePublicKey = isMigratedDid(did)
    ? getNameInfoForAddress(address)
    : fetchTransaction(txId)
        .pipe(map(parseAndValidateTransaction))
        .pipe(map(extractContractCallArgs))
        .pipe(
          // Fetch the zonefile given a name, namespace and zonefile hash
          chain((args) => {
            return fetchZoneFile(args).pipe(
              map((zonefile: string) => ({ ...args, zonefile, address }))
            )
          })
        )
        .pipe(chain(fetchPublicKeyFromZoneFile))
        .pipe(
          chain((data) => {
            return fetchNameInfo(data.name, data.namespace)
              .pipe(chain((info) => isDidStillActive(data, info)))
              .pipe(
                map(
                  (active) =>
                    active && {
                      publicKeyHex: data.publicKeyHex,
                    }
                )
              )
          })
        )

  //@ts-ignore
  return promise(resolvePublicKey).then(({ publicKeyHex }) =>
    buildDidDoc(did, publicKeyHex)
  )
}

// Does the address still own the name assigned to it at registration?
// Find the correct record using $ORIGIN
export const isDidStillActive = (
  originalRecord: NameRecord,
  currentZoneFile: string
) => {
  const parsedZoneFile = parseZoneFile(currentZoneFile)

  if (!parsedZoneFile) {
    throw new Error(
      `Failed to parse current zonefile, received content - ${currentZoneFile}`
    )
  }

  return fetchPublicKeyFromZoneFile({
    zonefile: currentZoneFile,
    name: originalRecord.name,
    namespace: originalRecord.namespace,
    address: originalRecord.ownerAddress,
  }).pipe(
    map((v: NameRecord) => v.publicKeyHex === originalRecord.publicKeyHex)
  )
}
