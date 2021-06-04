import {
  buildPreorderNameTx,
  buildPreorderNamespaceTx,
  buildRevealNamespaceTx,
  buildRegisterNameTx,
  buildReadyNamespaceTx,
  buildRenewNameTx,
  buildTransferNameTx,
  buildRevokeNameTx,
} from "@stacks/bns"
import { StacksNetwork } from "@stacks/network"
import { encodeFQN } from "../utils/general"
import {
  StacksKeyPair,
  waitForConfirmation,
  wait,
  addSpendPostCondition,
} from "./utils"
import {
  TransactionSigner,
  broadcastTransaction,
  getAddressFromPublicKey,
  TransactionVersion,
} from "@stacks/transactions"

import FormData from "form-data"
import { priceFunction, lifetime } from "./constants"
import { promise, chain, map } from "fluture"
import {
  makeProfileZoneFile,
  Profile,
  signProfileToken,
  wrapProfileToken,
} from "@stacks/profile"
import { fetchNameInfo } from "../api"
import { STX_TO_BURN } from "../constants"

const preorderNamespace = async (
  namespace: string,
  network: StacksNetwork,
  keyPair: StacksKeyPair
) => {
  console.log(
    `PREORDERING NAMESPACE - ${namespace}, BURNING - ${STX_TO_BURN.toString()}`
  )

  return buildPreorderNamespaceTx({
    namespace,
    salt: "salt",
    stxToBurn: STX_TO_BURN,
    publicKey: keyPair.publicKey.data.toString("hex"),
    network,
  })
    .then(addSpendPostCondition(keyPair.publicKey))
    .then(async (tx) => {
      const s = new TransactionSigner(tx)
      s.signOrigin(keyPair.privateKey)

      return broadcastTransaction(tx, network).then((txId) => {
        //@ts-ignore string and error
        return promise(waitForConfirmation(txId as string)).then(() => txId)
      })
    })
}

const revealNamespace = (
  namespace: string,
  network: StacksNetwork,
  keyPair: StacksKeyPair
) => {
  console.log(`REVEALING NAMESPACE - ${namespace}`)

  return buildRevealNamespaceTx({
    namespace,
    salt: "salt",
    priceFunction,
    lifetime,
    namespaceImportAddress: getAddressFromPublicKey(
      keyPair.publicKey.data,
      TransactionVersion.Testnet
    ),
    publicKey: keyPair.publicKey.data.toString("hex"),
    network,
  }).then((tx) => {
    const s = new TransactionSigner(tx)
    s.signOrigin(keyPair.privateKey)
    return broadcastTransaction(tx, network).then((txId) => {
      //@ts-ignore
      return promise(waitForConfirmation(txId as string)).then(() => txId)
    })
  })
}

const readyNamespace = (
  namespace: string,
  network: StacksNetwork,
  keyPair: StacksKeyPair
) => {
  console.log(`READYING NAMESPACE - ${namespace}`)

  return buildReadyNamespaceTx({
    network,
    namespace,
    publicKey: keyPair.publicKey.data.toString("hex"),
  }).then(async (tx) => {
    const s = new TransactionSigner(tx)
    s.signOrigin(keyPair.privateKey)

    return broadcastTransaction(tx, network).then((txId) => {
      //@ts-ignore
      return promise(waitForConfirmation(txId as string)).then(() => txId)
    })
  })
}

const preorderName = (
  name: string,
  namespace: string,
  keyPair: StacksKeyPair,
  network: StacksNetwork
) => {
  const fqn = encodeFQN({ name, namespace })
  console.log(`PREORDERING NAME - ${fqn}`)

  return buildPreorderNameTx({
    fullyQualifiedName: fqn,
    salt: "salt",
    stxToBurn: STX_TO_BURN,
    network,
    publicKey: keyPair.publicKey.data.toString("hex"),
  })
    .then(addSpendPostCondition(keyPair.publicKey))
    .then((tx) => {
      const signer = new TransactionSigner(tx)
      signer.signOrigin(keyPair.privateKey)

      return broadcastTransaction(tx, network).then((txId) => {
        //@ts-ignore
        return promise(waitForConfirmation(txId as string)).then(() => txId)
      })
    })
}

const registerName = (
  name: string,
  namespace: string,
  keyPair: StacksKeyPair,
  zonefile: string,
  network: StacksNetwork
) => {
  const fqn = encodeFQN({ name, namespace })
  console.log(`REGISTERING NAME - ${fqn}`)
  return buildRegisterNameTx({
    fullyQualifiedName: fqn,
    publicKey: keyPair.publicKey.data.toString("hex"),
    salt: "salt",
    zonefile,
    network,
  })
    .then(addSpendPostCondition(keyPair.publicKey))
    .then((tx) => {
      const signer = new TransactionSigner(tx)
      signer.signOrigin(keyPair.privateKey)

      return broadcastTransaction(tx, network, Buffer.from(zonefile)).then(
        (txId) => {
          //@ts-ignore
          return promise(
            waitForConfirmation(txId as string).pipe(chain(() => wait(5000)))
          ).then(() => txId as string)
        }
      )
    })
}

const transferName = async (
  name: string,
  namespace: string,
  currentKeyPair: StacksKeyPair,
  newKeyPair: StacksKeyPair,
  network: StacksNetwork
) => {
  const fqn = encodeFQN({ name, namespace })
  console.log(`TRANSFERRING NAME - ${fqn}`)

  const signed = signProfileToken(
    new Profile(),
    newKeyPair.privateKey.data.toString("hex")
  )
  const zf = makeProfileZoneFile(
    fqn,
    await storeTokenFile(wrapProfileToken(signed))
  )

  const newOwnerAddress = getAddressFromPublicKey(
    newKeyPair.publicKey.data,
    TransactionVersion.Testnet
  )

  return (
    buildTransferNameTx({
      fullyQualifiedName: fqn,
      newOwnerAddress,
      network,
      zonefile: zf,
      publicKey: currentKeyPair.publicKey.data.toString("hex"),
    })
      // .then(addSpendPostCondition(currentKeyPair.publicKey))
      .then((tx) => {
        const signer = new TransactionSigner(tx)
        signer.signOrigin(currentKeyPair.privateKey)

        return broadcastTransaction(tx, network, Buffer.from(zf)).then(
          (txId) => {
            console.log(txId)
            // @ts-ignore
            return promise(
              //@ts-ignore Waiting for the zonefile to propagate
              waitForConfirmation(txId as string)
                .pipe(chain(() => wait(5000)))
                .pipe(map(() => txId))
            )
          }
        )
      })
  )
}

// Not currently used
const renewName = async (
  name: string,
  namespace: string,
  currentKeyPair: StacksKeyPair,
  newKeyPair: StacksKeyPair,
  network: StacksNetwork
) => {
  const fqn = encodeFQN({ name, namespace })
  console.log(`RENEWING NAME - ${fqn}`)

  const signed = signProfileToken(
    new Profile(),
    newKeyPair.privateKey.data.toString("hex")
  )
  const zf = makeProfileZoneFile(
    fqn,
    await storeTokenFile(wrapProfileToken(signed))
  )

  const newOwnerAddress = getAddressFromPublicKey(
    newKeyPair.publicKey.data,
    TransactionVersion.Testnet
  )

  return buildRenewNameTx({
    fullyQualifiedName: fqn,
    stxToBurn: STX_TO_BURN,
    newOwnerAddress,
    network,
    zonefile: zf,
    publicKey: currentKeyPair.publicKey.data.toString("hex"),
  })
    .then(addSpendPostCondition(currentKeyPair.publicKey))
    .then((tx) => {
      const signer = new TransactionSigner(tx)
      signer.signOrigin(currentKeyPair.privateKey)

      return broadcastTransaction(tx, network, Buffer.from(zf)).then((txId) => {
        // @ts-ignore
        return promise(
          //@ts-ignore Waiting for the zonefile to propagate
          waitForConfirmation(txId as string)
            .pipe(chain(() => wait(5000)))
            .pipe(chain(() => fetchNameInfo({ name, namespace })))
        )
      })
    })
}

export const rotateKey = transferName

export const registerNamespace = async (
  namespace: string,
  network: StacksNetwork,
  keyPair: StacksKeyPair
) => {
  await preorderNamespace(namespace, network, keyPair)
  await revealNamespace(namespace, network, keyPair)
  await readyNamespace(namespace, network, keyPair)
}

export const preorderAndRegisterName = async (
  name: string,
  namespace: string,
  network: StacksNetwork,
  keyPair: StacksKeyPair
) => {
  const fqn = encodeFQN({ name, namespace })
  await preorderName(name, namespace, keyPair, network)

  const signed = signProfileToken(
    new Profile(),
    keyPair.privateKey.data.toString("hex")
  )

  const zf = makeProfileZoneFile(
    fqn,
    await storeTokenFile(wrapProfileToken(signed))
  )

  return await registerName(name, namespace, keyPair, zf, network)
}

export const revokeName = async (
  fqn: string,
  keyPair: StacksKeyPair,
  network: StacksNetwork
) => {
  console.log(`REVOKING NAME - ${fqn}}`)

  return buildRevokeNameTx({
    fullyQualifiedName: fqn,
    publicKey: keyPair.publicKey.data.toString("hex"),
    network,
  })
    .then(addSpendPostCondition(keyPair.publicKey))
    .then(async (tx) => {
      const s = new TransactionSigner(tx)
      s.signOrigin(keyPair.privateKey)

      return broadcastTransaction(tx, network).then((txId) => {
        //@ts-ignore string and error
        return promise(waitForConfirmation(txId as string)).then(() => txId)
      })
    })
}

const storeTokenFile = async (data: {}) => {
  const fd = new FormData()
  fd.append("file", Buffer.from(JSON.stringify([data])))

  const res = await fetch(`https://ipfs.jolocom.io/api/v0/add?pin=false`, {
    method: "POST",
    //@ts-ignore
    body: fd,
  })
  const { Hash } = await res.json()
  return `https://ipfs.jolocom.io/api/v0/cat/${Hash}`
}
