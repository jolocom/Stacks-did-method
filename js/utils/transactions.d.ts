import { Either } from "monet";
export declare type TransactionArguments = {
    name: string;
    namespace: string;
    zonefileHash: string;
    subdomainInception: boolean;
};
export declare const parseAndValidateTransaction: (tx: any) => Either<Error, TransactionArguments>;
