import {
  makeRandomPrivKey,
  getPublicKey,
  StacksPrivateKey,
  StacksPublicKey,
  createStacksPrivateKey,
  createStandardPrincipal,
  publicKeyToAddress,
  AddressVersion,
  StacksTransaction,
  parseAssetInfoString,
  createFungiblePostCondition,
  createLPList,
} from "@stacks/transactions"
import { fetchTransactionById } from "../api"
import Future, { chain, resolve, reject, FutureInstance } from "fluture"
import BN = require("bn.js")

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
    publicKey,
  }
}

export const addSpendPostCondition =
  (publicKey: StacksPublicKey) => (tx: StacksTransaction) => {
    // const pc = createFungiblePostCondition(
    //   createStandardPrincipal(
    //     publicKeyToAddress(AddressVersion.TestnetSingleSig, publicKey)
    //   ),
    //   3,
    //   new BN(0),
    //   parseAssetInfoString("S0000000000000000000002AA028H.BURNED::BURNED")
    // )
    // tx.postConditions = createLPList([pc])
    // tx.setFee(new BN(500))
    return tx
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
  console.log(`Pending, trying again in ${ms / 1000} sec`)
  return Future((_, res) => {
    const t = setTimeout(res, ms)
    return () => clearTimeout(t)
  })
}
