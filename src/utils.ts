import "isomorphic-fetch"
import { last, split } from "ramda"
import { DIDDocument } from "did-resolver"
import { DID_METHOD_PREFIX } from "./constants"
const b58 = require("bs58")

export const encodeFQN = (
  name: string,
  namespace: string,
  subdomain?: string
) => {
  return `${subdomain ? subdomain + "." : ""}${name}.${namespace}`
}

export const decodeFQN = (
  fqdn: string
): {
  name: string
  namespace: string
  subdomain?: string
} => {
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

export const parseZoneFileTXT = (entries: string[]) => {
  return entries.reduce(
    (parsed, current) => {
      const [prop, value] = current.split("=")

      if (prop.startsWith("zf")) {
        return { ...parsed, zonefile: `${parsed.zonefile}${value}` }
      }

      return { ...parsed, [prop]: value }
    },
    { zonefile: "", owner: "" }
  )
}

export const parseStacksV2DID = (did: string) => {
  const supportedMethod = "did:stacks:v2"

  if (did.startsWith(supportedMethod)) {
    const nsi = last(split(":", did))
    const [address, txId] = split("-", nsi)

    return {
      address,
      txId,
    }
  }
  return {}
}

export const stripHexPrefixIfPresent = (data: string) => {
  if (data.startsWith("0x")) return data.substr(2)

  return data
}

export const hexToAscii = (hex: string) =>
  Buffer.from(stripHexPrefixIfPresent(hex), "hex").toString("ascii")

export const buildStacksV2DID = (address: string, txId: string) =>
  `${DID_METHOD_PREFIX}${address}-${stripHexPrefixIfPresent(txId)}`

export const buildDidDoc = (did: string, publicKey: string): DIDDocument => {
  return {
    "@context": "https://www.w3.org/ns/did/v1",
    id: did,
    verificationMethod: [
      {
        id: `${did}#keys-1`,
        controller: `${did}`,
        type: "EcdsaSecp256k1VerificationKey2019",
        publicKeyBase58: b58.encode(Buffer.from(publicKey, "hex")),
      },
    ],
    authentication: [`${did}#keys-1`],
    assertionMethod: [`${did}#keys-1`],
  }
}
