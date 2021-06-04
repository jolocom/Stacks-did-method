import { StacksNetwork } from "@stacks/network"
import { StacksKeyPair } from "../src/registrar/utils"
import {
  preorderAndRegisterName,
  registerNamespace,
} from "../src/registrar/index"
import { decodeFQN, encodeFQN } from "../src/utils/general"
import { fetchNameInfo } from "../src/api"
import { map, promise } from "fluture"
import { encodeStacksV2Did } from "../src/utils/did"

export const setup = async (
  name: string,
  namespace: string,
  network: StacksNetwork,
  keyPair: StacksKeyPair
) => {
  await registerNamespace(namespace, network, keyPair)

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
