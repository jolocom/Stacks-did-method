import { c32ToB58 } from "c32check"
import { parseZoneFile } from "zone-file"
import { TokenInterface } from "jsontokens/lib/decode"
import { compose, curry, flip, head, identity } from "ramda"
import { verifyProfileToken } from "@stacks/profile"
import { hexToCV, cvToValue } from "@stacks/transactions"
import {
  hexToAscii,
  stripHexPrefixIfPresent,
  parseStacksV2DID,
  buildDidDoc,
  parseZoneFileTXT,
  decodeFQN,
  encodeFQN,
  extractTokenFileUrl,
  verifyAndParseProfileToken,
  parseZoneFileAndExtractTokenUrl,
} from "./utils"

import {
  fetchNameInfo,
  fetchNamesOwnedByAddress,
  fetchZoneFileForName,
  fetchTransactionById,
  fetchSignedToken,
} from "./api"
import { chain, map, promise, reject, resolve as fResolve, fold } from "fluture"
import { BNS_ADDRESSES, BNS_CONTRACT_DEPLOY_TXID } from "./constants"
import { None, Some, Maybe, Left, Right, Either } from "monet"
import { DIDDocument } from "did-resolver"
import { resolvePtr } from "dns"

const isMigratedOnChainDid = (did: string) => {
  const { txId } = parseStacksV2DID(did)
  return Object.values(BNS_CONTRACT_DEPLOY_TXID).includes(txId)
}

export const resolve = async (did: string) => {
  const { address, txId } = parseStacksV2DID(did)

  if (!address || !txId) {
    throw new Error(`address or txId undefined, ${{ address, txId }}`)
  }

  // .pipe(map(s => s.bimap((e: Error) => reject(e), verifyAndParseProfileToken(c32ToB58(address)))))

  const resolvePublicKey = isMigratedOnChainDid(did)
    ? fetchNamesOwnedByAddress(address)
        .pipe(map(head))
        .pipe(map(decodeFQN))
        .pipe(chain(fetchNameInfo))
        .pipe(
          map((info) => {
            return parseZoneFileAndExtractTokenUrl({
              expectedOwner: address,
              anchoringTxId: info["last_txid"],
              isMigratedDid: true,
            })(info.zonefile, info.address)
          })
        )
    : fetchTransactionById(txId)
        .pipe(map(parseAndValidateTransaction))
        .pipe(map((tx) => tx.chain(extractContractCallArgs)))
        .pipe(
          map((callArgs) =>
            chain(
              callArgs.chain(({ name, namespace, zonefileHash }) =>
                fetchZoneFileForName({ name, namespace, zonefileHash })
                  .pipe(
                    map((v) =>
                      getRecordsForName({ name, namespace, owner: address }, v)
                    )
                  )
                  .pipe(
                    map((result) =>
                      result.map((zf) =>
                        parseZoneFileAndExtractTokenUrl({
                          expectedOwner: address,
                          anchoringTxId: txId,
                        })(zf, address)
                      )
                    )
                  )
              )
            )
          )
        )

  return promise<DIDDocument>(
    resolvePublicKey.pipe(
      chain((key) => key.cata(reject, (k) => fResolve(buildDidDoc(did, k))))
    )
  )
}

//
//              .pipe(chain(e => fetchSignedToken))
//              .pipe(map((token) => token.map(verifyAndParseProfileToken(c32ToB58(address)))))
//              .pipe(chain((v) => v.cata(e => reject(new Error(e)), fetchSignedToken)))
//              .pipe(
//                map((t) => verifyProfileToken(t[0].token, c32ToB58(address)))
//              )
//              .pipe(map((v) => v["payload"]["subject"].publicKey))
//          )

type NameRecord = {
  name: string
  namespace: string
  subdomain?: string
  ownerAddress: string
  publicKeyHex: string
}

const parseAndValidateTransaction = (txData: any): Either<Error, string[]> => {
  // TODO Include name-import
  const allowedFunctionNames = ["name-register", "name-update"]
  const contractCallData = txData["contract_call"]

  if (!contractCallData) {
    return Left(new Error("resolve failed, no contract_call in fetched tx"))
  }

  if (!Object.values(BNS_ADDRESSES).includes(contractCallData["contract_id"])) {
    return Left(
      new Error(
        "Must reference TX to the BNS contract address, mainnet or testnet"
      )
    )
  }

  const calledFunction = contractCallData["function_name"]

  if (!allowedFunctionNames.includes(calledFunction)) {
    return Left(
      new Error(
        `call ${calledFunction} not allowed. supported methods are ${allowedFunctionNames.toString()}`
      )
    )
  }

  return Right(contractCallData["function_args"])
}

/**
 * Extracts the namespace, name, and zonefile-hash arguments from a name-register / name-update TX
 * @returns nameInfo - the name, namespace, and zonefile-hash encoded in the TX
 */

const extractContractCallArgs = (
  functionArgs: Array<any>
): Either<Error, { name: string; namespace: string; zonefileHash: string }> => {
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

  if (!name || !namespace || !zonefileHash) {
    return Left(
      new Error(
        `Not all arguments present, got ${JSON.stringify({
          name,
          namespace,
          zonefileHash,
        })}`
      )
    )
  }

  const hexEncodedValues = [name, namespace, zonefileHash].map(
    compose(stripHexPrefixIfPresent, cvToValue, hexToCV)
  )

  return Right({
    name: hexToAscii(hexEncodedValues[0]),
    namespace: hexToAscii(hexEncodedValues[1]),
    zonefileHash: hexEncodedValues[2],
  })
}

export const findNestedZoneFileByOwner = (
  zonefile: string,
  owner: string
): Maybe<string> => {
  const parsedZoneFile = parseZoneFile(zonefile)

  if (parsedZoneFile.txt) {
    const match = parsedZoneFile.txt.find(
      ({ txt }) => parseZoneFileTXT(txt).owner === c32ToB58(owner)
    )

    if (match) {
      return Some(
        Buffer.from(parseZoneFileTXT(match.txt).zonefile, "base64").toString(
          "ascii"
        )
      )
    }
  }

  return None()
}

export const getRecordsForName = (
  {
    name,
    namespace,
    subdomain,
    owner,
  }: { name: string; namespace: string; subdomain?: string; owner?: string },
  zonefile: string
): Either<Error, string> => {
  const parsedZoneFile = parseZoneFile(zonefile)
  const origin = decodeFQN(parsedZoneFile["$origin"])

  if (origin.name === name && origin.namespace === namespace) {
    if (origin.subdomain === subdomain) {
      return Right(zonefile)
    }

    // We are in the wrong zonefile somehow :(
    if (origin.subdomain && origin.subdomain !== subdomain) {
      return Left(
        new Error(
          `Wrong zonefile, zf origin - ${origin}, looking for ${encodeFQN(
            name,
            namespace,
            subdomain
          )}`
        )
      )
    }

    if (!origin.subdomain && subdomain) {
      if (!owner) {
        return Left(new Error(`No owner passed. Can not find nested zonefile.`))
      }
    }

    if (parsedZoneFile.txt) {
      return findNestedZoneFileByOwner(zonefile, owner).toEither()
    }

    return Left(new Error("zonefile not found"))
  }
}

// Does the address still own the name assigned to it at registration?
// Ensures that the key has not been changed as well
// TODO May have to account for key rotation
export const isDidStillActive = (
  { name, subdomain, ownerAddress, namespace, publicKeyHex }: NameRecord,
  currentZoneFile: string
) => {
  const parsedZoneFile = parseZoneFile(currentZoneFile)

  if (!parsedZoneFile) {
    return Left(
      new Error(
        `Failed to parse current zonefile, received content - ${currentZoneFile}`
      )
    )
  }

  return getRecordsForName(
    {
      name,
      namespace,
      subdomain,
      owner: ownerAddress,
    },
    currentZoneFile
  )
    .map(parseZoneFile)
    .map(extractTokenFileUrl)
    .cata(reject, fetchSignedToken)
    .pipe(chain(fetchSignedToken))
    .pipe(chain(curry(flip(verifyProfileToken))(ownerAddress)))
    .pipe(map((v) => v["payload"]["subject"].publicKey === publicKeyHex))
}
