import {
  makeRandomPrivKey,
  getPublicKey,
  StacksPrivateKey,
  StacksPublicKey,
  createStacksPrivateKey,
  isCompressed,
  compressPublicKey,
} from "@stacks/transactions"
import { fetchTransactionById } from "../api"
import Future, { chain, resolve, reject, FutureInstance } from "fluture"

export type StacksKeyPair = {
  privateKey: StacksPrivateKey
  publicKey: StacksPublicKey
}

export const getKeyPair = (privateKey?: string | Buffer): StacksKeyPair => {
  const priv = privateKey
    ? createStacksPrivateKey(privateKey)
    : makeRandomPrivKey()

  const publicKey = getPublicKey(priv)
  return {
    privateKey: priv,
    publicKey: isCompressed(publicKey)
      ? publicKey
      : compressPublicKey(publicKey.data),
  }
}

export const waitForConfirmation = (
  txId: string,
  delay: number = 3000
): FutureInstance<Error, {}> => {
  return wait(delay)
    .pipe(chain(() => fetchTransactionById(txId)))
    .pipe(
      chain((tx) => {
        if (tx.tx_status === "pending") {
          return waitForConfirmation(txId)
        }

        if (tx.tx_status === "success") {
          return resolve(tx)
        }

        return reject(new Error(`Tx failed, ${tx.tx_status} ${txId}`))
      })
    )
}

export const wait = (ms: number): FutureInstance<never, void> => {
  return Future((_, res) => {
    const t = setTimeout(res, ms)
    return () => clearTimeout(t)
  })
}
