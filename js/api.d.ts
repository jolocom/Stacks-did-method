import "isomorphic-fetch";
import { FutureInstance } from "fluture";
import { StacksNetwork } from "@stacks/network";
/**
 * Given a on-chain BNS name, will return the latest zonefile associated with it.
 * @param {String} name - the BNS name for which the zonefile will be retrieved
 * @param {String} namespace - the BNS namespace to which the BNS name belongs
 *
 * @returns {FutureInstance<Error ,String>} which resolves to the zonefile, as a string
 */
export declare const fetchZoneFileForName: (apiEndpoint: string) => (args: {
    name: string;
    namespace: string;
    zonefileHash?: string;
}) => FutureInstance<Error, string>;
/**
 * Given a Stacks Address, will return an array of BNS names owned by it.
 * @param {String} address - a c32 encoded Stacks Address
 *
 * @returns {FutureInstance<Error, String[]>} - an array of names owned by the address.
 */
export declare const fetchNamesOwnedByAddress: (apiEndpoint: string) => (address: string) => FutureInstance<Error, string[]>;
declare type NameInfo = {
    address: string;
    blockchain: string;
    expire_block: number;
    last_txid: string;
    status: string;
    zonefile: string;
    zonefile_hash: string;
};
/**
 * Will query a Stacks node for the latest state associated with a BNS name
 * @param {String} name - the BNS name for which the zonefile will be retrieved
 * @param {String} namespace - the BNS namespace to which the BNS name belongs
 *
 * @returns {NameInfo} - the name state received from the BNS contract / Stacks node
 */
export declare const fetchNameInfo: (network: StacksNetwork) => ({ name, namespace, }: {
    name: string;
    namespace: string;
}) => FutureInstance<Error, NameInfo>;
declare type TxStatus = "success" | "abort_by_response" | "abort_by_post_condition" | "pending";
/**
 * Given a Stacks transaction ID, will attempt to retrieve the corresponding transaction
 * from a Stacks blockchain node
 * @param {String} txId - the Stacks transaction identifier
 *
 * @returns the corresponding stacks transaction if found
 */
export declare const fetchTransactionById: (apiEndpoint: string) => (txId: string) => FutureInstance<Error, {
    tx_id: string;
    tx_status: TxStatus;
}>;
export declare const fetchSignedToken: (endpoint: string) => FutureInstance<Error, any>;
export declare const fetchAllNames: (apiEndpoint: string) => (page?: number) => FutureInstance<Error, string[]>;
export declare const getCurrentBlockNumber: (apiEndpoint: string) => FutureInstance<Error, number>;
export {};
