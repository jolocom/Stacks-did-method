import { compose } from "ramda"
import { hexToCV, cvToValue } from "@stacks/transactions"
import { hexToAscii, stripHexPrefixIfPresent } from "./general"
import { BNS_ADDRESSES } from "../constants"
import { Left, Right, Either } from "monet"

//TODO Find type for tx json

export type TransactionArguments = {
  name: string
  namespace: string
  zonefileHash: string
  subdomainInception: boolean
}

export const parseAndValidateTransaction = (
  tx: any
): Either<Error, TransactionArguments> => {
  const validOnChainDidInceptionEvents = ["name-register", "name-import"]

  const validOffChainDidInceptionEvents = ["name-import", "name-update"]

  if (tx.tx_status !== "success") {
    return Left(
      new Error(`Invalid TX status for ${tx.tx_id}, expected success`)
    )
  }
  const contractCallData = tx.contract_call

  if (!contractCallData) {
    return Left(new Error("resolve failed, no contract_call in fetched tx"))
  }

  if (!Object.values(BNS_ADDRESSES).includes(contractCallData.contract_id)) {
    return Left(
      new Error(
        "Must reference TX to the BNS contract address, mainnet or testnet"
      )
    )
  }

  const calledFunction = contractCallData["function_name"]

  return extractContractCallArgs(contractCallData.function_args).map((data) => {
    if (validOnChainDidInceptionEvents.includes(calledFunction)) {
      return {
        ...data,
        subdomainInception: false,
      }
    } else if (validOffChainDidInceptionEvents.includes(calledFunction)) {
      return {
        ...data,
        subdomainInception: true,
      }
    } else {
      return Left(
        new Error(
          `call ${calledFunction} not allowed. supported methods are ${[
            ...validOffChainDidInceptionEvents,
            ...validOffChainDidInceptionEvents,
          ].toString()}`
        )
      )
    }
  }) as Either<
    Error,
    {
      name: string
      namespace: string
      subdomainInception: boolean
      zonefileHash: string
    }
  >
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
    compose(cvToValue, hexToCV, stripHexPrefixIfPresent)
  )

  return Right({
    name: hexToAscii(hexEncodedValues[0]),
    namespace: hexToAscii(hexEncodedValues[1]),
    zonefileHash:
      typeof hexEncodedValues[2] === "string"
        ? stripHexPrefixIfPresent(hexEncodedValues[2])
        : stripHexPrefixIfPresent(hexEncodedValues[2].value),
  })
}
