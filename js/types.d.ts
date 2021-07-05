export declare enum DidType {
    onChain = "onChain",
    offChain = "offChain"
}
export declare enum StacksNetworkDeployment {
    test = "test",
    main = "main"
}
export declare type StacksV2DID = {
    prefix: "did:stack:v2";
    address: string;
    anchorTxId: string;
    metadata: {
        type: DidType;
        deployment: StacksNetworkDeployment;
    };
};
