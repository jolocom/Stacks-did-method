import { fork, chain, parallel, map } from "fluture"
import { findValidNames } from "../src/utils/dev"
import { range, flatten } from "ramda"
import { buildDidDoc, encodeStacksV2Did } from "../src/utils/did"
import { resolve } from "../src/"
import { revokeName, rotateKey } from "../src/registrar/index"
import { getKeyPair } from "../src/registrar/utils"
import { StacksMocknet } from "@stacks/network"
import * as chai from "chai"
import { BNS_CONTRACT_DEPLOY_TXID } from "../src/constants"
import { setup } from "./setup"
import { encodeFQN } from "../src/utils/general"
import { expect } from "chai"
import { getPublicKey } from "@stacks/transactions"
const b58 = require("bs58")

var chaiAsPromised = require("chai-as-promised")

chai.use(chaiAsPromised)
chai.should()

const mockNet = new StacksMocknet()

const initialKeyPair = getKeyPair(
  Buffer.from(
    "e75dcb66f84287eaf347955e94fa04337298dbd95aa0dbb985771104ef1913db01",
    "hex"
  )
)

const rotatedKeyPair = getKeyPair(
  Buffer.from(
    "21d43d2ae0da1d9d04cfcaac7d397a33733881081f0b2cd038062cf0ccbb752601",
    "hex"
  )
)

describe("did:stacks:v2 resolver", () => {
  let testNamespace = "testns"
  let testName = "testname"
  let testDid: string = ""

  before(async () => {
    const { did } = await setup(
      testName,
      testNamespace,
      mockNet,
      initialKeyPair
    )
    testDid = did
  })

  describe("resolution", () => {
    describe("Stacks V2 DIDs", () => {
      it("correctly resolves newly created Stacks v2 DID", async () => {
        return expect(resolve(testDid)).to.eventually.deep.eq(
          buildDidDoc(testDid)(
            getPublicKey(initialKeyPair.privateKey).data.toString("hex")
          )
        )
      })

      it("Should fail to resolve v2 DID after name was revoked", async () => {
        const testFqn = encodeFQN({ name: testName, namespace: testNamespace })
        await revokeName(testFqn, initialKeyPair, mockNet)
        return expect(resolve(testDid)).rejectedWith("DID Revoked")
      })

      it.skip("correctly resolves imported Stacks v2 DID", async () => {
        const testAddr = "SP15XBGYRVMKF1TWPXE6A3M0T2A87VYSVF9VFSZ1A"
        const testDid = encodeStacksV2Did({
          address: testAddr,
          anchorTxId: BNS_CONTRACT_DEPLOY_TXID.main,
        })

        return expect(resolve(testDid)).to.eventually.include({ id: testDid })
      })

      it.skip("Should correctly resolve v2 DID after the key was rotated", async () => {
        await rotateKey(
          testName,
          testNamespace,
          initialKeyPair,
          rotatedKeyPair,
          mockNet
        )

        return expect(resolve(testDid)).to.eventually.deep.eq(
          buildDidDoc(testDid)(
            getPublicKey(rotatedKeyPair.privateKey).data.toString("hex")
          )
        )
      })
    })
  })

  describe.skip("utils", () => {
    it("find all names", async () => {
      return fork(console.log)(console.log)(
        parallel(2)(range(0)(17).map(findValidNames(false)))
          .pipe(map(flatten))
          .pipe(chain(parallel(5)))
      )
    })
  })
})
