/// <reference types="node" />
import { StacksPrivateKey, StacksPublicKey } from "@stacks/transactions";
import { StacksNetwork } from "@stacks/network";
import { FutureInstance } from "fluture";
export declare type StacksKeyPair = {
    privateKey: StacksPrivateKey;
    publicKey: StacksPublicKey;
};
export declare const getKeyPair: (privateKey?: string | Buffer | undefined) => StacksKeyPair;
export declare const waitForConfirmation: (txId: string, network: StacksNetwork, delay?: number) => FutureInstance<Error, {}>;
export declare const wait: (ms: number) => FutureInstance<never, void>;
export declare const storeTokenFile: (data: {}) => Promise<string>;
