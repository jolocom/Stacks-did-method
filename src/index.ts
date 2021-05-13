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

  // TODO, replace with check agaisnt BnsContractAddress.mainnet/testnet
  if (
    ![
      `SP000000000000000000002Q6VF78.${BNS_CONTRACT_NAME}`,
      `ST000000000000000000002AMW42H.${BNS_CONTRACT_NAME}`,
    ].includes(contractCallData["contract_id"])
  ) {
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
  const argumentNames = ["name", "namespace", "zonefile-hash"]

  const {
    name,
    namespace,
    "zonefile-hash": zonefileHash,
  } = functionArgs.reduce((previous, current) => {
    if (argumentNames.includes(current.name)) {
      return { ...previous, [current.name]: current.hex }
    }
    return previous
  }, {})

  const parsedValues = [name, namespace, zonefileHash].map(
    compose(
      stripHexPrefixIfPresent,
      cvToValue,
      hexToCV,
      stripHexPrefixIfPresent
    )
  )

  return {
    name: hexToAscii(parsedValues[0]),
    namespace: hexToAscii(parsedValues[1]),
    zonefileHash: parsedValues[2],
  }
}

// TODO Exported for testing
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
  const deploy_tx_id =
    "d8a9a4528ae833e1894eee676af8d218f8facbf95e166472df2c1a64219b5dfb"
  const { txId } = parseStacksV2DID(did)
  return txId === deploy_tx_id
}

const getNameInfoForAddress = (address: string) => {
  return fetchNamesForAddress(address)
    .pipe(
      chain((names) => {
        if (Array.isArray(names) && names.length !== 1) {
          throw new Error()
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
          throw new Error("")
        }

        if (nameInfo.address !== address) {
          throw new Error("")
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
  currentNameInfo: any
) => {
  const parsedZoneFile = parseZoneFile(currentNameInfo.zonefile)

  if (!parsedZoneFile) {
    throw new Error()
  }

  // TODO Handle subdomains here
  if (
    parsedZoneFile["$origin"] !==
    encodeFQN(originalRecord.name, originalRecord.namespace)
  ) {
    throw new Error(`$ORIGIN does not match, got parsedZoneFile['$origin']`)
  }

  return fetchPublicKeyFromZoneFile({
    zonefile: currentNameInfo.zonefile,
    name: originalRecord.name,
    namespace: originalRecord.namespace,
    address: originalRecord.ownerAddress,
  }).pipe(
    map((v: NameRecord) => v.publicKeyHex === originalRecord.publicKeyHex)
  )
}
