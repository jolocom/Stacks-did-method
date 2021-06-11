import {
  buildPreorderNameTx,
  buildPreorderNamespaceTx,
  buildRevealNamespaceTx,
  buildRegisterNameTx,
  buildReadyNamespaceTx,
  buildRenewNameTx,
  buildTransferNameTx,
  buildRevokeNameTx,
  buildUpdateNameTx
} from "@stacks/bns"
import { StacksNetwork } from "@stacks/network"
const { parseZoneFile, makeZoneFile } = require("zone-file")
import { decodeFQN, encodeFQN, normalizeAddress } from "../utils/general"
import {
  StacksKeyPair,
  waitForConfirmation,
  wait,
} from "./utils"
import {
  TransactionSigner,
  broadcastTransaction,
  getAddressFromPublicKey,
  TransactionVersion,
  getPublicKey,
  AddressVersion,
  publicKeyToAddress
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
import { fetchNameInfo, fetchZoneFileForName } from "../api"
import { STX_TO_BURN } from "../constants"
import { encodeStacksV2Did } from "../utils/did"

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
      .then((tx) => {
        const signer = new TransactionSigner(tx)
        signer.signOrigin(currentKeyPair.privateKey)

        return broadcastTransaction(tx, network, Buffer.from(zf)).then(
          (txId) => {
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
  console.log(`REVOKING NAME - ${fqn}`)

  return buildRevokeNameTx({
    fullyQualifiedName: fqn,
    publicKey: keyPair.publicKey.data.toString("hex"),
    network,
  })
    .then(async (tx) => {
      const s = new TransactionSigner(tx)
      s.signOrigin(keyPair.privateKey)

      return broadcastTransaction(tx, network).then((txId) =>
        promise(waitForConfirmation(txId as string)).then(() => txId)
      )
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

export const updateName = async(fqn: string, newZoneFile: string, keyPair: StacksKeyPair, network: StacksNetwork) => {
  return buildUpdateNameTx({
    fullyQualifiedName: fqn,
    zonefile: newZoneFile,
    publicKey: keyPair.publicKey.data.toString('hex'),
    network
  }).then(async (tx) => {
      const s = new TransactionSigner(tx)
      s.signOrigin(keyPair.privateKey)

      return broadcastTransaction(tx, network, Buffer.from(newZoneFile)).then(txId =>
        promise(waitForConfirmation(txId as string)).then(() => txId)
      )
  })
}

export const registerSubdomain = async (fqn: string, nameOwnerKey: StacksKeyPair, subdomainOptions: {
  owner?: string,
  ownerKeyPair: StacksKeyPair
}, network: StacksNetwork) => {
    const {name, namespace, subdomain} = decodeFQN(fqn)

    if (!subdomain) {
      throw new Error('provided fqn must include subdomain')
    }

    const currentZf = await promise(fetchZoneFileForName({
      name,
      namespace
    }))

    const parsed = parseZoneFile(currentZf)

    const subdomainZoneFile = await buildSubdomainZoneFile(fqn, subdomainOptions.ownerKeyPair)

    const address = publicKeyToAddress(AddressVersion.TestnetSingleSig, getPublicKey(subdomainOptions.ownerKeyPair.privateKey))
    const owner = subdomainOptions.owner || address

    const newSubdomainOp = subdomainOpToZFPieces(subdomainZoneFile, normalizeAddress(owner), subdomain)
    if (parsed?.txt?.length) {
      parsed.txt.push(newSubdomainOp)
    } else {
      parsed.txt = [newSubdomainOp]
    }

    const ZONEFILE_TEMPLATE = '{$origin}\n{$ttl}\n{txt}{uri}'

    const txId = await updateName(encodeFQN({name, namespace}), makeZoneFile(parsed, ZONEFILE_TEMPLATE), nameOwnerKey, network)

    return encodeStacksV2Did({
      address: owner, 
      anchorTxId: txId as string
    })
}

const buildSubdomainZoneFile = async (fqn: string, keyPair: StacksKeyPair) => {
  const signedToken = signProfileToken(
    new Profile(),
    keyPair.privateKey.data.toString("hex")
  )

  const zf = makeProfileZoneFile(
    fqn,
    await storeTokenFile(wrapProfileToken(signedToken))
  )

  return zf
}

function subdomainOpToZFPieces(zonefile: string, owner: string, subdomainName: string, signature?: string) {
  const destructedZonefile = destructZonefile(zonefile)
  const txt = [
    `owner=${owner}`,
    `seqn=0`,
    `parts=${destructedZonefile.length}`
  ]
  destructedZonefile.forEach((zfPart, ix) => txt.push(`zf${ix}=${zfPart}`))

  if (signature) {
    txt.push(`sig=${signature}`)
  }

  return {
    name: subdomainName,
    txt
  }
}

function destructZonefile(zonefile: string) {
  const encodedZonefile = Buffer.from(zonefile).toString('base64')
  // we pack into 250 byte strings -- the entry "zf99=" eliminates 5 useful bytes,
  // and the max is 255.
  const pieces = 1 + Math.floor(encodedZonefile.length / 250)
  const destructed = []
  for (let i = 0; i < pieces; i++) {
    const startIndex = i * 250
    const currentPiece = encodedZonefile.slice(startIndex, startIndex + 250)
    if (currentPiece.length > 0) {
      destructed.push(currentPiece)
    }
  }
  return destructed
}

