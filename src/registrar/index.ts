import { canRegisterName, buildPreorderNameTx, getNamePrice } from "@stacks/bns"
import { encaseP, chain, attemptP } from "fluture"
import { StacksTestnet } from "@stacks/network"
import { encodeFQN } from "../utils"
import { StacksKeyPair } from "./utils"
import bn = require("bn.js")
import { TransactionSigner, broadcastTransaction } from "@stacks/transactions"

export const registerName = (
  name: string,
  namespace: string,
  keyPair: StacksKeyPair
) => {
  const network = new StacksTestnet()

  getNamePrice({fullyQualifiedName: encodeFQN(name, namespace), network}).then(p => console.log(p.toString()))
  return encaseP(checkNameAvailable)({ name, namespace, network })
    .pipe(
      chain(() =>
        encaseP(buildPreorderNameTx)({
          fullyQualifiedName: encodeFQN(name, namespace),
          publicKey: keyPair.publicKey.data.toString("hex"),
          salt: "hello",
          network,
          stxToBurn: new bn(2000000),
        })
      )
    )
    .pipe(
      chain((tx) => {
        const signer = new TransactionSigner(tx)
        signer.signOrigin(keyPair.privateKey)
        return attemptP(() => broadcastTransaction(tx, network))
      })
    )
}

const checkNameAvailable = async ({ name, namespace, network }) => {
  return canRegisterName({
    fullyQualifiedName: encodeFQN(name, namespace),
    network,
  }).then((canRegister) => {
    if (!canRegister) {
      throw new Error(`can't register name ${encodeFQN(name, namespace)}`)
    }
  })
}
