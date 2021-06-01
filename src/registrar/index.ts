import {
  buildPreorderNameTx,
  buildPreorderNamespaceTx,
  buildRevealNamespaceTx,
  buildRegisterNameTx,
  buildReadyNamespaceTx,
  buildRenewNameTx,
  buildTransferNameTx,
} from "@stacks/bns"
import { StacksNetwork } from "@stacks/network"
import { encodeFQN } from "../utils/general"
import { getKeyPair } from "./utils"
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

import { StacksMocknet } from "@stacks/network"

export const preorderNamespace = async (
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

export const revealNamespace = (
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

export const readyNamespace = (
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

export const preorderName = (
  name: string,
  namespace: string,
  keyPair: StacksKeyPair,
  network: StacksNetwork
) => {
  const fqn = encodeFQN(name, namespace)
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

export const registerName = (
  name: string,
  namespace: string,
  keyPair: StacksKeyPair,
  zonefile: string,
  network: StacksNetwork
) => {
  const fqn = encodeFQN(name, namespace)
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
          return promise(waitForConfirmation(txId as string)
            .pipe(chain(() => wait(5000)))).then(
            () => txId as string
          )
        }
      )
    })
}

export const transferName = async (
  name: string,
  namespace: string,
  currentKeyPair: StacksKeyPair,
  newKeyPair: StacksKeyPair,
  network: StacksNetwork
) => {
  const fqn = encodeFQN(name, namespace)
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

  return buildTransferNameTx({
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

      return broadcastTransaction(tx, network, Buffer.from(zf)).then((txId) => {
        console.log(txId)
          // @ts-ignore
        return promise(
          //@ts-ignore Waiting for the zonefile to propagate
          waitForConfirmation(txId as string)
            .pipe(chain(() => wait(5000)))
            .pipe(map(() => txId))
        )
      })
    })
}


export const renewName = async (
  name: string,
  namespace: string,
  currentKeyPair: StacksKeyPair,
  newKeyPair: StacksKeyPair,
  network: StacksNetwork
) => {
  const fqn = encodeFQN(name, namespace)
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
  const fqn = encodeFQN(name, namespace)
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


let testNamespace = "testns"
let testName = "testname"

const registerTestName = async (
  name: string,
  namespace: string,
  network: StacksNetwork,
  keyPair: StacksKeyPair
) => {
  await registerNamespace(namespace, network, keyPair)
  await preorderAndRegisterName(name, namespace, network, keyPair)
}

const regularDIDKeyPair = getKeyPair(
  Buffer.from(
    "e75dcb66f84287eaf347955e94fa04337298dbd95aa0dbb985771104ef1913db01",
    "hex"
  )
)

const rotatedKeyDIDKeyPair = getKeyPair(
  Buffer.from(
    "21d43d2ae0da1d9d04cfcaac7d397a33733881081f0b2cd038062cf0ccbb752601",
    "hex"
  )
)

const transferredNameKeyPair = getKeyPair(
  Buffer.from(
    "c71700b07d520a8c9731e4d0f095aa6efb91e16e25fb27ce2b72e7b698f8127a01",
    "hex"
  )
)

const mockNet = new StacksMocknet()

// registerNamespace(testNamespace, mockNet, regularDIDKeyPair)
// preorderAndRegisterName(testName, testNamespace, mockNet, regularDIDKeyPair)
// rotateKey(testName, testNamespace, regularDIDKeyPair, rotatedKeyDIDKeyPair, mockNet)

export const storeTokenFile = (data: {}) => {
  const fd = new FormData()
  fd.append("file", Buffer.from(JSON.stringify([data])))

  return fetch(`https://ipfs.jolocom.io/api/v0/add?pin=false`, {
    method: "POST",
    //@ts-ignore
    body: fd,
  })
    .then((res) => res.json())
    .then(({ Hash }) => `https://ipfs.jolocom.io/api/v0/cat/${Hash}`)
}
