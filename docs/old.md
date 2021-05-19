# [WIP] Resolution specification

Created: Apr 20, 2021 11:13 AM
Created By: Eugeniu Rusu
Last edited by: Eugeniu Rusu
Related to Project: https://www.notion.so/Stacks-8fe737843cf44d899904894fe5f2761b
Resource Type: Document

**Some useful links:**

- [Decentralized Identifiers specification](https://www.w3.org/TR/did-core/)
- `[did:stacks:v1` DID method specification](https://github.com/blockstack/stacks-blockchain/blob/stacks-1.0/docs/blockstack-did-spec.md)
- [BNS contract source](https://github.com/blockstack/stacks-blockchain/blob/master/src/chainstate/stacks/boot/bns.clar), deployed contract can [be found here](https://explorer.stacks.co/txid/SP000000000000000000002Q6VF78.bns)
- [Development Milestones](https://www.notion.so/Development-Milestones-ca3cc8622b0c4634be5d41b7200af7e3)

### Requirements / assumptions:

- New did method `did:stacks:v2` will be developed, and a new DID method specification document will be created.
    - Relevant changes from the first iteration of the DID method - we can now assume that one principal owns one on-chain name (the BNS implementation has been updated to a clarity contract).  The principal can still own multiple off-chain names / subdomains.
    - Both on-chain and off-chain based DIDs ([as defined here](https://github.com/blockstack/stacks-blockchain/blob/stacks-1.0/docs/blockstack-did-spec.md#112-off-chain-dids)) will be supported.
    - The format of the method specific identifier (i.e. the suffix following `did:stacks:v2:`) will be updated.
- The new DID method relies on the [BNS clarity](https://explorer.stacks.co/txid/SP000000000000000000002Q6VF78.bns?chain=mainnet) smart contract for DID resolution.

    Implications are that in order for DID resolution to succeed, the `address` encoded in the [method specific identifier](https://www.w3.org/TR/did-core/#did-syntax) must have a registered BNS name.

    - The deactivation of the DID is achieved by revoking / transferring ownership of the corresponding name (similar to the process described in [section 4 of the Stacks DID method specification](https://github.com/blockstack/stacks-blockchain/blob/stacks-1.0/docs/blockstack-did-spec.md#4-deleting-a-blockstack-did)).
    - The DID method would not support key rotation / update operations, as elaborated on later.
- Some resolution steps (e.g. fetching, parsing and verifying the zonefile associated with a name, retrieving and verifying the signature on the associated `token`) are similar to the previous iteration of the DID method.

## did:stacks:v2 identifier format

Since the layout of the names on the chain has changed with the introduction of the BNS clarity contract, we can now assume that a key may own at most one on-chain name. The following statement from [section 1.1](https://github.com/blockstack/stacks-blockchain/blob/stacks-1.0/docs/blockstack-did-spec.md#11-did-lifecycle). of the Stacks V1 DID method specification therefore no longer holds:

*Each name in Blockstack has one or more corresponding DIDs, and each Blockstack DID corresponds to exactly one name -- even if the name was revoked by its owner, expired, or was re-registered to a different owner.* 

The current `did:stacks`  [NSI (namespace specific identifier )](https://github.com/blockstack/stacks-blockchain/blob/stacks-1.0/docs/blockstack-did-spec.md#21-namespace-specific-identifier) includes a combination of an address and an index (used to indicate the number of names ever assigned to the owner address at the time of this DID's instantiation). The `index` part of the NSI was required as part of the resolution process bind the DID to a specific name record. The resolution process makes use of the `zonefile` associated with the retrieved name in order to resolve and verify public key associated with the `address`.

---

Given the aforementioned name layout change (and the fact that a principal can only own one on-chain name), we no longer have to include an `index` in the DID. We briefly considered a new, simpler structure for the Stacks V2 DID:

*did:stacks:v2:{address}*

But this approach has the following disadvantages:

- It is not immediately clear how this can be used for off-chain DIDs (backed by names anchored via [subdomains](https://docs.stacks.co/build-apps/references/bns#subdomains)). It does not seem like the BNS contract can be used directly (i.e. the `[resolve-principal](https://github.com/blockstack/stacks-blockchain/blob/master/src/chainstate/stacks/boot/bns.clar#L881)` does not suffice).
- The DID is not bound to a specific BNS name. At different times, the DID might own different names. The resolution process should still result in the correct (same) public keys being returned, even if the underlying BNS name has changed. In order to support DID deactivation, it might make sense to bind the DID to a specific BNS name, owned by the DID at the time of its creation.

---

An alternative DID structure which aims to address some of the shortcomings listed above could be defined as:

*did:stacks:v2:{address}-{transactionId}*

The `transactionId` value included in the NSI can be used to reference the specific blockchain transaction which registered the name. The transaction is expected to be a `[name-register](https://explorer.stacks.co/txid/0xd27cb8d9cd4a9f21b1582c5c89a0d303aa613261ad41b729b48bf714f9cd1a02?chain=mainnet)` or `[name-update](https://explorer.stacks.co/txid/0x61ddabdbf9bc4e431fede7c0293fab88ca6059f531dcec0e1c8c527f6c23af2d)` method call. The `zonefile-hash`, `namespace` and `name` arguments can be used as part of the resolution process (i.e. to retrieve the associated `zonefile`). The retrieved `zonefile` can be used to obtain the key material associated with the name (and by extension, with the DID) at the time of its registration.

*In case the DID corresponds to an off-chain name, the contents of the referenced `zonefile` will need to be parsed, and the appropriate TXT record(s) can be used to retrieve the associated public key.*

This approach (although more complicated) helps address the two issues outlined above, namely:

- Simplifies resolving off-chain DIDs. The transaction referenced by the `transactionId` should contain enough information to allow us to retrieve the `zonefile` which lists the `owner` and the key material associated with the off-chain DID.
- The inclusion of the `transactionId` value in the NSI binds the DID to a specific name registration operation. Once the name registered in the referenced transaction is revoked or transferred (i.e. once it's owner / public key changes), the DID can be considered deactivated.

One downside of this approach is that it results in larger DIDs, as can be seen in this example:  

`did:stacks:v2:SP1YMQJR0T1P52RT1VVPZZYZEQXQ5HBE6VWR36HFE-d642e67370f7ecd35b3417aa3f4c3546c7d628ddc2dbb4b4202ba85ba831367a`

---

One further approach / DID NSI structure we have considered looks as follows:

*did:stacks:v2:{address}-{blockHeight}*

In this case, instead of including the exact `transactionId` during which the name associated with the DID was registered, we include the the chain tip / `blockHeight` at the time of DID registration. During resolution, the `blockHeight` value can be used to make a call to a "bns-proxy" Clarity smart contract. This contract would expose two methods, `resolve-principal-at-block` and `name-resolve-at-block`. These methods would make a proxy call to the deployed BNS contract, making use of the ["at-block"](https://docs.stacks.co/references/language-functions#at-block) function to retrieve the name record and subsequently the associated `zonefile` associated with the name at the included `blockHeight`.

This approach would result in shorter DIDs compared to the previous suggestion, but introduces a few open questions:

- If we take this approach, multiple different DIDs which reference the same underlying `name record` could be created, for example  `did:stacks:v2:example-14000` and `did:stacks:v2:example-14001` would reference the same underlying identity (assuming no relevant name transfer / revoke operations were included in the block). This might pose problems in some use cases (e.g. usage with access control lists).
- It is not immediately clear how this can be used for off-chain DIDs (backed by names anchored via [subdomains](https://docs.stacks.co/build-apps/references/bns#subdomains)). It does not seem like the BNS contract can be used directly (i.e. the `[resolve-principal](https://github.com/blockstack/stacks-blockchain/blob/master/src/chainstate/stacks/boot/bns.clar#L881)` does not suffice).

### DID Resolution process

Given the following example Stacks V2 DID: 

The exact resolution steps might vary depending on the selected DID structure. In the context of the *did:stacks:v2:{address}-{transactionId}* approach

The resolution steps are as follows:

1. Separate the `address` and `transactionId` arguments
2. Fetch the transaction referenced by the `transactionId`, and extract the `name`, `namespace` and `zonefile-hash` arguments included within.
3. Retrieve the `zonefile` associated with the `zonefile-hash` returned from the transaction described in the previous step.
    1. Find the appropriate record in the `zonefile` (i.e. scan for the correct `$ORIGIN` value)
    2. Find the included `URI` resource record (which encodes an HTTP / HTTPS url) and issue an HTTP request to the endpoint to retrieve a JSON Web Token signed by the the public key associated with the address.
        - Token example

            ```jsx
            [
              [
                {
                  "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksifQ.eyJqdGkiOiJiNjFkMzY5Yi05ZjNmLTRmZjMtYmQwNS1hMTdlYWNmMWY3MzciLCJpYXQiOiIyMDE4LTA0LTE5VDE1OjM4OjE3Ljc4NVoiLCJleHAiOiIyMDE5LTA0LTE5VDE1OjM4OjE3Ljc4NVoiLCJzdWJqZWN0Ijp7InB1YmxpY0tleSI6IjAyMTQzOGIwMDc4YjRkYjFjYzA4MDUzMzFlZGJmNjQ0NjY2NmRjZTQ2YjE0MWYwNzNkYTg4ZjgxODQzYTIyOTQ0NiJ9LCJpc3N1ZXIiOnsicHVibGljS2V5IjoiMDIxNDM4YjAwNzhiNGRiMWNjMDgwNTMzMWVkYmY2NDQ2NjY2ZGNlNDZiMTQxZjA3M2RhODhmODE4NDNhMjI5NDQ2In0sImNsYWltIjp7IkB0eXBlIjoiUGVyc29uIiwiQGNvbnRleHQiOiJodHRwOi8vc2NoZW1hLm9yZyIsImFwcHMiOnsiaHR0cHM6Ly90ZXN0bmV0Lm1pc3Rob3MuaW8iOiJodHRwczovL2dhaWEuYmxvY2tzdGFjay5vcmcvaHViLzFIbmJMTW9jRHpOck5lTmRWb2RDdmZBNEo3SGZZb0tBZTkvIn19fQ._y8mL357qi8JtcKOrt9GhOA1pzmjqLS-kCEFc1kO3V-ijL4xRX2lJGeYDEQ9MkWCkfMzSzxTLz2f1rihO29_FQ",
                  "decodedToken": {
                    "header": {
                      "typ": "JWT",
                      "alg": "ES256K"
                    },
                    "payload": {
                      "jti": "b61d369b-9f3f-4ff3-bd05-a17eacf1f737",
                      "iat": "2018-04-19T15:38:17.785Z",
                      "exp": "2019-04-19T15:38:17.785Z",
                      "subject": {
                        "publicKey": "021438b0078b4db1cc0805331edbf6446666dce46b141f073da88f81843a229446"
                      },
                      "issuer": {
                        "publicKey": "021438b0078b4db1cc0805331edbf6446666dce46b141f073da88f81843a229446"
                      },
                      "claim": {
                        "@type": "Person",
                        "@context": "http://schema.org",
                        "apps": {
                          "https://testnet.misthos.io": "https://gaia.blockstack.org/hub/1HnbLMocDzNrNeNdVodCvfA4J7HfYoKAe9/"
                        }
                      }
                    },
                    "signature": "_y8mL357qi8JtcKOrt9GhOA1pzmjqLS-kCEFc1kO3V-ijL4xRX2lJGeYDEQ9MkWCkfMzSzxTLz2f1rihO29_FQ"
                  }
                }
              ]
            ]
            ```

4. Ensure that the public keys (i.e. `decodedToken.subject.publicKey` and `decodedToken.issuer.publicKey`) hash to the correct address (i.e. the `owner` of the name record, and the `address` being resolved / included in the DID). Verify the JSON Web Signature associated with the token.
5. At this stage, the key material associated with the DID at the time of it's creation is known. Before returning a DID document, we need to make sure that the DID has not been deactivated (i.e. that the underlying BNS name is still owned by the original creator).
6. Given the `name` and `namespace` values obtained at step 2, make a `[name-resolve](https://github.com/blockstack/stacks-blockchain/blob/master/src/chainstate/stacks/boot/bns.clar#L928)` function call to the deployed [BNS contract](https://explorer.stacks.co/txid/SP000000000000000000002Q6VF78.bns).
7. Retrieve the `zonefile` associated with the `zonefile-hash` returned from the contract call described in the previous step.
    1. Find the appropriate record in the `zonefile` (i.e. the `$ORIGIN` matches the `name + namespace`)
    2. Find the included `URI` resource record (which encodes an HTTP / HTTPS url) and issue an HTTP request to the endpoint to retrieve a JSON Web Token signed by the the public key associated with the address.
    3. Ensure that the public key did not change since DID creation, and verify the JSON Web Signature associated with the token.
8. Return a DID Document generated based on the DID / retrieved key material. The BNS name associated with the DID could be included in the resolution metadata.

### Deactivating a Blockstack V2 DID

Similarly to the approach described in the first version of the [Blockstack DID Method Specification](https://github.com/blockstack/stacks-blockchain/blob/stacks-1.0/docs/blockstack-did-spec.md#4-deleting-a-blockstack-did), the lifecycle of the DID is tied to the lifecycle of the underlying name record.

In order to deactivate an on-chain DID backend, the corresponding name (registered in the BNS contract) needs to be revoked (via a `name-revoke` call) or transferred to another owner (via a `name-transfer` call).

- Open question

    We have identified a number of statements hinting to the fact that the ownership of a name can be changed to rotate keys associated with the corresponding DID (e.g. [section 4.3 of the original DID Method specification](https://github.com/blockstack/stacks-blockchain/blob/stacks-1.0/docs/blockstack-did-spec.md#34-updating-a-blockstack-did), [the BNS contract documentation](https://github.com/blockstack/stacks-blockchain/blob/master/src/chainstate/stacks/boot/bns.clar#L673)), specific example would be the following statement:

    *If the DID corresponds to an on-chain name, then the user must send a NAME_TRANSFER transaction to send the name to the new address. Once the transaction is confirmed by the Blockstack network, the DID's public key will be updated.*

    This might not be supported by the DID resolver (e.g. all DID's who's underlying names have been transferred would be considered deactivated). It seems like there is no way to differentiate between an owner change operation intended to change / rotate the associated keys, and an owner change operation transferring the name to a different, unafiliated owner.

- Older notes

    Given a DID of structure *did:stacks:v2:{address}-{blockHeight}*

    The resolution steps are as follows:

    1. Separate the `address` and `blockHeight` arguments
    2. Call the `resolve-principal-at-block` method defined on the `bns-proxy` contract described above, passing the `address` and the `blockHeight` arguments. As previously described, this will result in a `resolve-principal` function call on the deployed BNS contract, at the specified block height. If no name record is returned, the resolution should fail with an error. Otherwise proceed to next step.
    3. Call the `name-resolve-at-block` method defined on the `bns-proxy` contract described above, passing the `name` and `namespace` values returned in step 2. This will result in a `name-resolve` function call on the deployed BNS contract at the specified block height. If the call succeedes, proceed to step 4, otherwise resolution should fail with an error.
    4. Extract the `owner`, `zonefile-hash`, `lease-started-at` and `lease-ended-at` associated with the name. The `owner` must match the `address` being resolved. Our current assumption is that the `lease-started-at` and the `lease-ended-at` values do not need to be verified, because of the [enforcements in the `name-resolve` function](https://github.com/blockstack/stacks-blockchain/blob/master/src/chainstate/stacks/boot/bns.clar#L940-L950). The `zonefile-hash` return value will be used in the next step.
    5. Retrieve the `zonefile` associated with the `zonefile-hash` returned in the previous step. Open questions:
        1. How can a `zonefile` be retrieved?
        The only relevant code we were able to find is [here](https://github.com/blockstack/stacks-blockchain-api/blob/bns-refactor/src/api/routes/bns/names.ts#L11) and [here](https://github.com/blockstack/stacks-blockchain-api/blob/bns-refactor/src/api/routes/bns/names.ts#L28). Current assumption is that we can make a call to the `/:name/zonefile/:zoneFileHash` (passing the `name` + `namespace` values returned in step 3, and the `zonefile-hash` returned in step 4 as arguments) endpoint to retrieve the zonefile. 
    6. Parse and validate the returned zonefile, relevant repositories / code-bases [here](https://github.com/blockstack/zone-file-js). Then scan the zone file contents for the correct `$ORIGIN` entry, and extract the corresponding `URI` resource record.
