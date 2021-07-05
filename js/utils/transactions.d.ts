import { Either } from "monet";
import { StacksV2DID } from "../types";
export declare type TransactionArguments = {
    name: string;
    namespace: string;
    zonefileHash: string;
};
export declare const parseAndValidateTransaction: (did: StacksV2DID) => (tx: any) => Either<Error, TransactionArguments>;
