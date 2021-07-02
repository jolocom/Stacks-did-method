import { AddressVersion } from "@stacks/transactions"
import { c32addressDecode, c32address, c32ToB58 } from "c32check/lib/address"
import { FutureInstance, reject, resolve } from "fluture"
import { Either } from "monet"
import { versionByteToDidType } from "../constants"

export const stripHexPrefixIfPresent = (data: string) => {
  if (data.startsWith("0x")) return data.substr(2)

  return data
}

export const hexToAscii = (hex: string) =>
  Buffer.from(stripHexPrefixIfPresent(hex), "hex").toString("ascii")

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

export const decodeFQN = (fqdn: string): FQN => {
  const nameParts = fqdn.split(".")
  if (nameParts.length > 2) {
    const subdomain = nameParts[0]
    const name = nameParts[1]
    const namespace = nameParts[2]
    return {
      subdomain,
      name,
      namespace,
    }
  } else {
    const name = nameParts[0]
    const namespace = nameParts[1]
    return {
      name,
      namespace,
    }
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
