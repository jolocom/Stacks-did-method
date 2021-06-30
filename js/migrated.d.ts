import { StacksV2DID } from "./types";
import { StacksNetwork } from "@stacks/network";
export declare const getPublicKeyForMigratedDid: ({ address, anchorTxId }: StacksV2DID, network: StacksNetwork) => import("fluture").FutureInstance<Error, {
    name: string;
    publicKey: string;
}>;
