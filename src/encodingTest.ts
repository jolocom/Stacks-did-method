import {
  AddressVersion,
  publicKeyToAddress,
} from "@stacks/transactions"
import { c32addressDecode } from "c32check/lib/address"
import { getKeyPair } from "./registrar/utils"

const testKey = 'cb3df38053d132895220b9ce471f6b676db5b9bf0b4adefb55f2118ece2478df01'


const kp = getKeyPair(Buffer.from(testKey, 'hex'))

console.log(publicKeyToAddress(
  AddressVersion.TestnetSingleSig, 
  kp.publicKey
))

const mainNet = publicKeyToAddress(
  AddressVersion.MainnetSingleSig, 
  kp.publicKey
)

const subd = publicKeyToAddress(
  0,
  kp.publicKey
)

console.log(c32addressDecode(mainNet))
console.log(c32addressDecode(subd))
