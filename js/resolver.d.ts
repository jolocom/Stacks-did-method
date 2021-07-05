import { DIDDocument } from "did-resolver";
import { StacksNetwork } from "@stacks/network";
export declare const getResolver: (stacksNetwork?: StacksNetwork) => (did: string) => Promise<DIDDocument>;
