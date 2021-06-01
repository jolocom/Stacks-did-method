import { c32addressDecode, c32address, c32ToB58 } from "c32check/lib/address"

export const stripHexPrefixIfPresent = (data: string) => {
  if (data.startsWith("0x")) return data.substr(2)

  return data
}

export const hexToAscii = (hex: string) =>
  Buffer.from(stripHexPrefixIfPresent(hex), "hex").toString("ascii")

export const encodeFQN = (
  name: string,
  namespace: string,
  subdomain?: string
) => {
  return `${subdomain ? subdomain + "." : ""}${name}.${namespace}`
}

export type FQN = {
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

export const testNetAddrToMainNetAddr = (address: string) => {
  const [version, hash] = c32addressDecode(address)
  if (version === 22) {
    return address
  }

  if (version === 26) {
    return c32ToB58(c32address(22, hash))
  }

  throw new Error("Unknown version number, " + version)
}
