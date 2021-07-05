import { StacksNetwork } from "@stacks/network";
import { StacksV2DID } from "../types";
export declare const mapDidToBNSName: (did: StacksV2DID, network: StacksNetwork) => import("fluture").FutureInstance<unknown, {
    name: string;
    namespace: string;
    subdomain: string | undefined;
    tokenUrl: string;
}>;
