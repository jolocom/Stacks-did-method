import {
  makeRandomPrivKey,
  getPublicKey,
  getAddressFromPublicKey,
  TransactionVersion,
  StacksPrivateKey,
  StacksPublicKey,
  createStacksPrivateKey,
} from "@stacks/transactions"
import "isomorphic-fetch"
import { encaseP, map } from "fluture"

export type StacksKeyPair = {
  privateKey: StacksPrivateKey
  publicKey: StacksPublicKey
}

export const getKeyPair = (privateKey?: string | Buffer): StacksKeyPair => {
  const priv = privateKey ? createStacksPrivateKey(privateKey) : makeRandomPrivKey()
  const publicKey = getPublicKey(priv)
  return {
    privateKey: priv,
    publicKey,
  }
}

const fuelAddress = (address: string) => {
  const endpoint =
    "https://stacks-node-api.testnet.stacks.co/extended/v1/faucets/stx?address="
  const request = new Request(`${endpoint}${address}`, {
    method: "POST",
  })

  return encaseP(fetch)(request).pipe(map((res) => res.ok))
}

export const getFueledKeyPair = () => {
  const { privateKey, publicKey } = getKeyPair()
  const addr = getAddressFromPublicKey(
    publicKey.data,
    TransactionVersion.Testnet
  )

  return fuelAddress(addr).pipe(
    map(
      (ok) =>
        ok && {
          privateKey,
          publicKey,
          address: addr,
        }
    )
  )
}
