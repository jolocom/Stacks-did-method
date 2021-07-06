import { AddressVersion } from "@stacks/transactions"
import { c32addressDecode, c32address, c32ToB58 } from "c32check/lib/address"
import { FutureInstance, reject, resolve } from "fluture"
import { Either, Left, Maybe, None, Right, Some } from "monet"
import { versionByteToDidType } from "../constants"

export const stripHexPrefixIfPresent = (data: string) => {
  if (data.startsWith("0x")) return data.substr(2)

  return data
}

export const encodeFQN = (args: {
  name: string
  namespace: string
  subdomain?: string
}) => {
  const { name, subdomain, namespace } = args
  return `${subdomain ? subdomain + "." : ""}${name}.${namespace}`
}

type FQN = {
  name: string
  namespace: string
  subdomain?: string
}

export const decodeFQN = (fqdn: string): Either<Error, FQN> => {
  const nameParts = fqdn.split(".")
  if (nameParts.length < 2) {
    return Left(new Error("Invalid FQN")) // TODO Error Code
  }

  if (nameParts.length === 3) {
    const [subdomain, name, namespace] = nameParts
    return Right({
      subdomain,
      name,
      namespace,
    })
  } else {
    const [name, namespace] = nameParts
    return Right({
      name,
      namespace,
    })
  }
}
/*
 * Converts a mainnet / testnet / off-chain c32 encoded address to a b58 encoded uncompressed address
 *
 */

export const normalizeAddress = (address: string) => {
  try {
    const [version, hash] = c32addressDecode(address)
    if (version === AddressVersion.MainnetSingleSig) {
      return c32ToB58(address)
    }

    const didMetadata = versionByteToDidType[version]

    if (didMetadata) {
      return c32ToB58(c32address(AddressVersion.MainnetSingleSig, hash))
    }

    throw new Error("Address Version Byte not supported - " + version)
  } catch {
    return address
  }
}

export const createRejectedFuture = <R, F>(
  rejectWith: R
): FutureInstance<R, F> => {
  return reject(rejectWith) as FutureInstance<R, F>
}

export const eitherToFuture = <L, R>(
  either: Either<L, R>
): FutureInstance<L, R> => {
  return either.fold((v) => createRejectedFuture<L, R>(v), resolve)
}
