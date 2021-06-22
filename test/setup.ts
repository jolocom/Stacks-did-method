import { StacksNetwork } from "@stacks/network"
import { getKeyPair, StacksKeyPair, wait } from "../src/registrar/utils"
import {
  preorderAndRegisterName,
  registerNamespace,
  registerSubdomain,
} from "../src/registrar/index"
import { decodeFQN, encodeFQN } from "../src/utils/general"
import { fetchNameInfo } from "../src/api"
import { map, promise } from "fluture"
import { encodeStacksV2Did } from "../src/utils/did"
// import {
//   AddressVersion,
//   publicKeyToAddress,
// } from "@stacks/transactions"

export const setup = async (
  name: string,
  namespace: string,
  network: StacksNetwork,
  keyPair: StacksKeyPair
) => {
  try {
    await registerNamespace(namespace, network, keyPair)
  } catch {
    console.log(
      "Did not register",
      namespace,
      "due to error, probably already registered"
    )
  }

  await preorderAndRegisterName(name, namespace, network, keyPair)

  const fqn = encodeFQN({ name, namespace })

  return {
    fqn,
    did: await promise(getDIDFromName(fqn)),
  }
}

export const getDIDFromName = (fqn: string) => {
  return fetchNameInfo(decodeFQN(fqn)).pipe(
    map(({ address, last_txid }) =>
      encodeStacksV2Did({ address, anchorTxId: last_txid })
    )
  )
}

export const setupSubdomains = async (
  fqn: string,
  nameOwnerKey: StacksKeyPair,
  network: StacksNetwork
) => {
  const { name, namespace } = decodeFQN(fqn)
  const keyPair1 = getKeyPair()

  const validDIDFqn = encodeFQN({ name, namespace, subdomain: "validsubd" })

  const validDid = await registerSubdomain(
    validDIDFqn,
    nameOwnerKey,
    {
      ownerKeyPair: keyPair1,
    },
    network
  )

  await promise(wait(2500))

  //   const keyPair2 = getKeyPair()
  //   const invalidOwner = publicKeyToAddress(
  //     AddressVersion.TestnetSingleSig,
  //     getKeyPair().publicKey
  //   )
  //
  //   const invalidDIDFqn = encodeFQN({ name, namespace, subdomain: 'invalidsubd' })
  //   const invalidDid = await registerSubdomain(
  //     invalidDIDFqn,
  //     nameOwnerKey,
  //     {
  //       ownerKeyPair: keyPair2,
  //       owner: invalidOwner,
  //     },
  //     network
  //   )
  //
  //   await promise(wait(2500))

  return {
    validDid: {
      did: validDid,
      key: keyPair1,
      fqn: validDIDFqn,
    },
    //  invalidDid: {
    //    did: invalidDid,
    //    key: keyPair2,
    //    fqn: invalidDIDFqn
    //  },
  }
}
