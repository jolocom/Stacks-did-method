import { StacksNetwork } from "@stacks/network"
import { StacksKeyPair } from '../src/registrar/utils'
import { preorderAndRegisterName, registerNamespace } from '../src/registrar/index'
import { decodeFQN, encodeFQN } from "../src/utils/general"
import { fetchNameInfo } from "../src/api"
import { map, promise } from 'fluture'
import { buildStacksV2DID } from "../src/utils/did"

type NamesHistory = {
    [k: string]: string[]
}

export const setup = (state: NamesHistory) => async (name: string, namespace: string, network: StacksNetwork, keyPair: StacksKeyPair) => {
    await registerNamespace(namespace, network, keyPair)

    const txId = await preorderAndRegisterName(name, namespace, network , keyPair)
    state[encodeFQN(name, namespace)] = [txId]

    const fqn = encodeFQN(name, namespace)

    return {
        fqn,
        did: await promise(getDIDFromName(fqn))
    }
}

export const getDIDFromName = (fqn: string) => {
    return fetchNameInfo(decodeFQN(fqn)).pipe(map(({address, last_txid}) =>
        buildStacksV2DID(address, last_txid)
    ))
}
