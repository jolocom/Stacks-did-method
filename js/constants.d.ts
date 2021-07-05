import { DidType, StacksNetworkDeployment } from "./types";
export declare const DID_METHOD_PREFIX = "did:stack:v2";
export declare const SUBDOMAIN_REVOKED_ADDR = "1111111111111111111114oLvT2";
export declare const BNS_ADDRESSES: {
    main: string;
    test: string;
};
export declare const BNS_CONTRACT_DEPLOY_TXID: {
    test: string;
    main: string;
};
export declare const OffChainAddressVersion: {
    mainnet: number;
    testnet: number;
};
export declare const versionByteToDidType: {
    [x: number]: {
        type: DidType;
        deployment: StacksNetworkDeployment;
    };
    22: {
        type: DidType;
        deployment: StacksNetworkDeployment;
    };
    26: {
        type: DidType;
        deployment: StacksNetworkDeployment;
    };
};
