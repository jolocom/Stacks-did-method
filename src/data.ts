import { stripHexPrefixIfPresent } from "./utils"

const address = "SPDBEG5X8XD50SPM1JJH0E5CTXGDV5NJTKAKKR5V"
const txId = "61ddabdbf9bc4e431fede7c0293fab88ca6059f531dcec0e1c8c527f6c23af2d"
export const testDID = `did:stacks:v2:${address}-${txId}`
export const DID_METHOD_PREFIX = "did:stacks:v2:"

export const makeTestDid = (address: string, txId: string) =>
  `${DID_METHOD_PREFIX}${address}-${stripHexPrefixIfPresent(txId)}`
