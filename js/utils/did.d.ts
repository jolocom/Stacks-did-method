import { DIDDocument } from "did-resolver";
import { StacksV2DID } from "../types";
import { Either } from "monet";
export declare const buildDidDoc: ({ did, publicKey, }: {
    did: string;
    publicKey: string;
}) => DIDDocument;
export declare const parseStacksV2DID: (did: string) => Either<Error, StacksV2DID>;
export declare const encodeStacksV2Did: (did: {
    address: string;
    anchorTxId: string;
}) => string;
export declare const isMigratedOnChainDid: (did: string | StacksV2DID) => boolean | Either<Error, void>;
