import { FutureInstance } from "fluture";
import { Either } from "monet";
export declare const stripHexPrefixIfPresent: (data: string) => string;
export declare const hexToAscii: (hex: string) => string;
export declare const encodeFQN: (args: {
    name: string;
    namespace: string;
    subdomain?: string;
}) => string;
declare type FQN = {
    name: string;
    namespace: string;
    subdomain?: string;
};
export declare const decodeFQN: (fqdn: string) => FQN;
export declare const normalizeAddress: (address: string) => string;
export declare const createRejectedFuture: <R, F>(rejectWith: R) => FutureInstance<R, F>;
export declare const eitherToFuture: <L, R>(either: Either<L, R>) => FutureInstance<L, R>;
export {};
