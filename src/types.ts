export enum DidType {
  onChain = 'onChain',
  offChain = 'offChain'
}

export type StacksV2DID = {
  prefix: "did:stack:v2"
  address: string
  anchorTxId: string
  type: DidType
}
