import { buildUpdateNameTx } from "@stacks/bns"
import { TransactionSigner, broadcastTransaction } from "@stacks/transactions"
import { StacksNetwork } from "@stacks/network"
import { decodeFQN, encodeFQN, normalizeAddress } from "../utils/general"
import {
  getKeyPair,
  StacksKeyPair,
  waitForConfirmation,
  storeTokenFile,
} from "./utils"
import { getPublicKey, publicKeyToAddress } from "@stacks/transactions"
import { promise } from "fluture"
import {
  makeProfileZoneFile,
  Profile,
  signProfileToken,
  wrapProfileToken,
} from "@stacks/profile"
import { fetchZoneFileForName } from "../api"
import { encodeStacksV2Did } from "../utils/did"
import { parseZoneFileTXT } from "../utils/zonefile"
import { OFF_CHAIN_ADDR_VERSION } from "../constants"
const { parseZoneFile, makeZoneFile } = require("zone-file")

export const registerSubdomain = async (
  fqn: string,
  nameOwnerKey: StacksKeyPair,
  subdomainOptions: {
    owner?: string
    ownerKeyPair: StacksKeyPair
  },
  network: StacksNetwork
) =>
  rekeySubdomain(
    fqn,
    nameOwnerKey,
    {
      newOwnerAddress: subdomainOptions.owner,
      newOwnerKeyPair: subdomainOptions.ownerKeyPair,
    },
    network
  )

export const rekeySubdomain = async (
  fqn: string,
  nameOwnerKey: StacksKeyPair,
  subdomainOptions: {
    newOwnerAddress?: string
    newOwnerKeyPair: StacksKeyPair
  },
  network: StacksNetwork
) => {
  const { name, namespace, subdomain } = decodeFQN(fqn)
  if (!subdomain) {
    throw new Error("provided fqn must include subdomain")
  }

  const zf = await promise(
    fetchZoneFileForName(network.coreApiUrl)({
      name,
      namespace,
    })
  )

  const currentZf = parseZoneFile(zf)

  const subdomainZF = await buildSubdomainZoneFile(
    fqn,
    subdomainOptions.newOwnerKeyPair
  )

  const owner =
    subdomainOptions.newOwnerAddress ||
    publicKeyToAddress(
      OFF_CHAIN_ADDR_VERSION,
      getPublicKey(subdomainOptions.newOwnerKeyPair.privateKey)
    )

  const existingRecordIdx = currentZf?.txt?.findIndex(
    (record: any) => record.name === subdomain
  )

  const newSubdomainOp = subdomainOpToZFPieces(
    subdomainZF,
    normalizeAddress(owner),
    subdomain,
    existingRecordIdx >= 0
      ? 1 +
          parseInt(parseZoneFileTXT(currentZf.txt[existingRecordIdx].txt).seqn)
      : 0
  )

  if (currentZf?.txt?.length) {
    if (existingRecordIdx >= 0) {
      currentZf.txt[existingRecordIdx] = newSubdomainOp
    } else {
      currentZf.txt.push(newSubdomainOp)
    }
  } else {
    currentZf.txt = [newSubdomainOp]
  }

  const ZONEFILE_TEMPLATE = "{$origin}\n{$ttl}\n{txt}{uri}"

  const txId = await updateName(
    encodeFQN({ name, namespace }),
    makeZoneFile(currentZf, ZONEFILE_TEMPLATE),
    nameOwnerKey,
    network
  )

  return encodeStacksV2Did({
    anchorTxId: txId as string,
    address: publicKeyToAddress(
      0,
      getPublicKey(subdomainOptions.newOwnerKeyPair.privateKey)
    ),
  })
}

export const revokeSubdomain = async (
  fqn: string,
  nameOwnerKey: StacksKeyPair,
  network: StacksNetwork
) => {
  const revokeAddr = "1111111111111111111114oLvT2"

  const randomKey = getKeyPair()
  return rekeySubdomain(
    fqn,
    nameOwnerKey,
    {
      newOwnerAddress: revokeAddr,
      newOwnerKeyPair: randomKey,
    },
    network
  )
}

const buildSubdomainZoneFile = async (
  fqn: string,
  keyPair: StacksKeyPair,
  signedTokenUrl?: string
) => {
  const signedToken = signProfileToken(
    new Profile(),
    keyPair.privateKey.data.toString("hex")
  )

  const zf = makeProfileZoneFile(
    fqn,
    signedTokenUrl || (await storeTokenFile(wrapProfileToken(signedToken)))
  )

  return zf
}

function subdomainOpToZFPieces(
  zonefile: string,
  owner: string,
  subdomainName: string,
  seqn = 0,
  signature?: string
) {
  const destructedZonefile = destructZonefile(zonefile)
  const txt = [
    `owner=${owner}`,
    `seqn=${seqn}`,
    `parts=${destructedZonefile.length}`,
  ]
  destructedZonefile.forEach((zfPart, ix) => txt.push(`zf${ix}=${zfPart}`))

  if (signature) {
    txt.push(`sig=${signature}`)
  }

  return {
    name: subdomainName,
    txt,
  }
}

function destructZonefile(zonefile: string) {
  const encodedZonefile = Buffer.from(zonefile).toString("base64")
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

const updateName = async (
  fqn: string,
  newZoneFile: string,
  keyPair: StacksKeyPair,
  network: StacksNetwork
) => {
  return buildUpdateNameTx({
    fullyQualifiedName: fqn,
    zonefile: newZoneFile,
    publicKey: keyPair.publicKey.data.toString("hex"),
    network,
  }).then(async (tx) => {
    const s = new TransactionSigner(tx)
    s.signOrigin(keyPair.privateKey)

    return broadcastTransaction(tx, network, Buffer.from(newZoneFile)).then(
      (txId) =>
        promise(waitForConfirmation(txId as string, network)).then(() => txId)
    )
  })
}
