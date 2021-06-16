import { c32addressDecode, c32address, c32ToB58 } from "c32check/lib/address"
import { FutureInstance, reject } from "fluture"

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

// Given a testnet, or a mainnet c32 encoded address, will return the b58 encoded uncompressed address
export const normalizeAddress = (address: string) => {
  const [version, hash] = c32addressDecode(address)
  if (version === 22) {
    return c32ToB58(address)
  }

  if (version === 26) {
    return c32ToB58(c32address(22, hash))
  }

  throw new Error("Unknown version number, " + version)
}

export const createRejectedFuture = <R, F>(
  rejectWith: R
): FutureInstance<R, F> => {
  return reject(rejectWith) as FutureInstance<R, F>
}
