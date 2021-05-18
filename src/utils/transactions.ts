import { compose } from "ramda"
import { hexToCV, cvToValue } from "@stacks/transactions"
import { hexToAscii, stripHexPrefixIfPresent } from "./general"

import {
  fetchNameInfo,
  fetchNamesOwnedByAddress,
  fetchZoneFileForName,
  fetchTransactionById,
  fetchSignedToken,
} from "../api"
import { BNS_ADDRESSES } from "../constants"
import { Left, Right, Either } from "monet"

export const parseAndValidateTransaction = (
  txData: any
): Either<Error, string[]> => {
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

export const extractContractCallArgs = (
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
