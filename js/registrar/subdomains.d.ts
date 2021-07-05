import { StacksNetwork } from "@stacks/network";
import { StacksKeyPair } from "./utils";
export declare const registerSubdomain: (fqn: string, nameOwnerKey: StacksKeyPair, subdomainOptions: {
    owner?: string;
    ownerKeyPair: StacksKeyPair;
}, network: StacksNetwork) => Promise<string>;
export declare const rekeySubdomain: (fqn: string, nameOwnerKey: StacksKeyPair, subdomainOptions: {
    newOwnerAddress?: string;
    newOwnerKeyPair: StacksKeyPair;
}, network: StacksNetwork) => Promise<string>;
export declare const revokeSubdomain: (fqn: string, nameOwnerKey: StacksKeyPair, network: StacksNetwork) => Promise<string>;
