import { StacksNetwork } from "@stacks/network";
import { StacksKeyPair } from "./utils";
export declare const rekeyName: (name: string, namespace: string, currentKeyPair: StacksKeyPair, newKeyPair: StacksKeyPair, network: StacksNetwork) => Promise<import("@stacks/transactions").TxBroadcastResult>;
/**
 * Returns the DID for the newly registered name
 */
export declare const preorderAndRegisterName: (name: string, namespace: string, network: StacksNetwork, keyPair: StacksKeyPair) => Promise<string>;
export declare const revokeName: (name: string, namespace: string, keyPair: StacksKeyPair, network: StacksNetwork) => Promise<string | import("@stacks/transactions").TxBroadcastResultRejected>;
