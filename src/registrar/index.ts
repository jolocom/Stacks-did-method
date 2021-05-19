import { canRegisterName, buildPreorderNameTx } from "@stacks/bns"
import { encaseP, chain, attemptP } from "fluture"
import { StacksTestnet, StacksNetwork } from "@stacks/network"
import { encodeFQN } from "../utils/general"
import { StacksKeyPair } from "./utils"
import { TransactionSigner, broadcastTransaction } from "@stacks/transactions"
import bn = require("bn.js")

export const registerName = (
  name: string,
  namespace: string,
  keyPair: StacksKeyPair
) => {
  const network = new StacksTestnet()

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

const checkNameAvailable = async ({
  name,
  namespace,
  network,
}: {
  name: string
  namespace: string
  network: StacksNetwork
}) => {
  return canRegisterName({
    fullyQualifiedName: encodeFQN(name, namespace),
    network,
  }).then((canRegister) => {
    if (!canRegister) {
      throw new Error(`can't register name ${encodeFQN(name, namespace)}`)
    }
  })
}
