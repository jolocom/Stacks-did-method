import { fork, chain, parallel, map } from "fluture"
import { randomBytes } from "crypto"
import { findValidNames } from "../src/utils/dev"
import { range, flatten } from "ramda"
import { buildDidDoc, encodeStacksV2Did } from "../src/utils/did"
import { resolve } from "../src/"
import {
  preorderAndRegisterName,
  revokeName,
  revokeSubdomain,
  rotateKey,
} from "../src/registrar/index"
import { getKeyPair, StacksKeyPair } from "../src/registrar/utils"
import { StacksMocknet } from "@stacks/network"
import * as chai from "chai"
import { BNS_CONTRACT_DEPLOY_TXID } from "../src/constants"
import { setup, setupSubdomains } from "./setup"
import { encodeFQN } from "../src/utils/general"
import { expect } from "chai"
import {
  AddressVersion,
  compressPublicKey,
  getPublicKey,
  publicKeyToAddress,
} from "@stacks/transactions"
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

const subdomainRegistrarKeyPair = getKeyPair(
  Buffer.from(
    "c71700b07d520a8c9731e4d0f095aa6efb91e16e25fb27ce2b72e7b698f8127a01",
    "hex"
  )
)

const INIT_NAMESPACE = true

describe("did:stacks:v2 resolver", () => {
  let testNamespace = "testn"
  let testName = "testname"
  let testSubdomainName = "offch"
  let testDid: string = ""

  before(async () => {
    if (INIT_NAMESPACE) {
      // Registering name for On-Chain DID resolution tests
      const { did } = await setup(
        testName,
        testNamespace,
        mockNet,
        initialKeyPair
      )
      testDid = did
    }

    // Registering name for later Off-Chain DID registration and resolution tests
    await preorderAndRegisterName(
      testSubdomainName,
      testNamespace,
      mockNet,
      subdomainRegistrarKeyPair
    )
  })

  describe("DID Resolution", () => {
    describe("On-chain Stacks v2 DIDs", () => {
      it("correctly resolves newly created Stacks v2 DID", async () => {
        return expect(resolve(testDid)).to.eventually.deep.eq(
          buildDidDoc({
            did: testDid,
            publicKey: getPublicKey(initialKeyPair.privateKey).data.toString(
              "hex"
            ),
          })
        )
      })

      it("Should correctly resolve v2 DID after the key was rotated", async () => {
        await rotateKey(
          testName,
          testNamespace,
          initialKeyPair,
          rotatedKeyPair,
          mockNet
        )

        return expect(resolve(testDid)).to.eventually.deep.eq(
          buildDidDoc({
            did: testDid,
            publicKey: getPublicKey(rotatedKeyPair.privateKey).data.toString(
              "hex"
            ),
          })
        )
      })

      it("Should fail to resolve v2 DID after name was revoked", async () => {
        const testFqn = encodeFQN({ name: testName, namespace: testNamespace })
        await revokeName(testFqn, rotatedKeyPair, mockNet)
        return expect(resolve(testDid)).rejectedWith(
          "Name bound to DID was revoked"
        )
      })

      it.skip("Should correctly resolves v2 DID based on migrated name", async () => {
        const testAddr = "SPWA58Z5C5JJW2TTJEM8VZA71NJW2KXXB2HA1V16"
        const testDid = encodeStacksV2Did({
          address: testAddr,
          anchorTxId: BNS_CONTRACT_DEPLOY_TXID.main,
        })

        return expect(resolve(testDid)).to.eventually.include({ id: testDid })
      })

      it.skip("Should fail to resolve v2 DID based on expired name", async () => {
        const testAddr = "SP15XBGYRVMKF1TWPXE6A3M0T2A87VYSVF9VFSZ1A"
        const testDid = encodeStacksV2Did({
          address: testAddr,
          anchorTxId: BNS_CONTRACT_DEPLOY_TXID.main,
        })

        return expect(resolve(testDid)).rejectedWith(
          "Name bound to DID expired"
        )
      })
    })

    describe("Off-chain Stacks v2 DIDs", () => {
      let testDidValid: {
        did: string
        key: StacksKeyPair
        fqn: string
      }

      let testDidInvalid: {
        did: string
        key: StacksKeyPair
        fqn: string
      }

      before(async () => {
        // const { invalidDid, validDid } = await setupSubdomains(
        const { validDid } = await setupSubdomains(
          encodeFQN({
            name: testSubdomainName,
            namespace: testNamespace,
          }),
          subdomainRegistrarKeyPair,
          mockNet
        )

        testDidValid = validDid
        // testDidInvalid = invalidDid
      })

      it("correctly resolves off-chain Stacks v2 DID", async () => {
        const compressedPublicKey = compressPublicKey(
          getPublicKey(testDidValid.key.privateKey).data
        )

        return expect(resolve(testDidValid.did)).to.eventually.deep.eq(
          buildDidDoc({
            did: testDidValid.did,
            publicKey: compressedPublicKey.data.toString("hex"),
          })
        )
      })

      it("correctly fails to resolve a off-chain Stacks v2 DID after it was revoked", async () => {
        const { fqn, key, did } = testDidValid
        await revokeSubdomain(
          fqn,
          subdomainRegistrarKeyPair,
          {
            ownerKeyPair: key,
          },
          mockNet
        )

        return expect(resolve(did))
          .rejectedWith("PostResolution: failed to fetch latest public key")
      })

      it("fails to resolve non-existent valid DID", async () => {
        const mockTxId = randomBytes(32).toString("hex")
        const randomAddress = publicKeyToAddress(
          AddressVersion.TestnetSingleSig,
          getKeyPair().publicKey
        )

        return expect(
          resolve(
            encodeStacksV2Did({ address: randomAddress, anchorTxId: mockTxId })
          )
        ).rejectedWith("could not find transaction by ID")
      })

      it.skip("fails to resolve if associated public key does not map to the name owner", async () => {
        return expect(resolve(testDidInvalid.did)).rejectedWith(
          "Token issuer public key does not match the verifying value"
        )
      })
    })
  })

  describe.skip("utils", () => {
    it("find all names", async () => {
      return fork(console.log)(console.log)(
        parallel(2)(range(0)(17).map(findValidNames(true, true)))
          .pipe(map(flatten))
          .pipe(chain(parallel(5)))
      )
    })
  })
})
