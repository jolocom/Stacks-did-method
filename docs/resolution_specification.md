Blockstack V2 DID Method Specification

# Abstract

Blockstack is a network for decentralized applications where users own their
identities and data.  Blockstack utilizes a public blockchain to implement a
decentralized [naming
layer](https://docs.blockstack.org/core/naming/introduction.html), which binds a
user's human-readable username to their current public key and a pointer to
their data storage buckets.  The naming layer ensures that names are globally
unique, that names can be arbitrary human-meaningful strings, and that names are
owned and controlled by cryptographic key pairs such that only the owner of the
private key can update the name's associated state.

This document describes a DID method built around the BNS naming layer. It
describes how a resolvable DID can be derived given a BNS name, as well as how
these DIDs can be updated, revoked, and resolved.

# Status of This Document

This document is not a W3C Standard nor is it on the W3C Standards Track.  This
is a draft document and may be updated, replaced or obsoleted by other documents
at any time. It is inappropriate to cite this document as other than work in
progress.

Comments regarding this document are welcome. Please file issues directly on
[Github](https://github.com/jolocom/Stacks-DID-Resolver).

# 1. System Overview

Blockstack's DID method is specified as part of its decentralized naming system.
Each Blockstack name has one corresponding DIDs, and each Blockstack DID
corresponds to exactly one name -- even if the name was revoked by its owner or
expired.

Blockstack is unique among decentralized identity systems in that it is *not*
anchored to a specific blockchain or DLT implementation.  The system is designed
from the ground up to be portable, and has already been live-migrated from the
Namecoin blockchain to the Bitcoin blockchain.  The operational ethos of
Blockstack is to leverage the must secure blockchain at all times -- that is,
the one that is considered hardest to attack.

Blockstack's naming system and its DIDs transcend the underlying blockchain, and
will continue to resolve to DID document objects (DDOs) even if the system
migrates to a new blockchain in the future.

## 1.1 DID Lifecycle

Understanding how Blockstack DIDs operate requires understanding how Blockstack
names operate.  Fundamentally, a Blockstack DID is defined as a pointer to a
*BNS name registered by an address*. Any updates to the underlying name can be
mapped to corresponding updates for the derived DID (e.g. key rotation,
revocation, etc.).

The BNS system differentiates between two types of names, *on-chain* and
*off-chain*.  Both *on-chain* and *off-chain* names can be used to derive a
resolvable Stacks v2 DID (*on-chain* and *off-chain* DIDs respectively), since
they can be resolved to their current owner, as well as their associated public
key(s) using the BNS contract and the Blockstack Atlas peer network.

The following subsections will go into more detail on the difference between
`on-chain` and `off-chain` names, as well as the properties of the resulting
DIDs.

## 1.2 On-Chain DIDs

On-chain DIDs are based on [BNS
names](https://docs.stacks.co/build-apps/references/bns#organization-of-bns)
whose records are stored directly on the blockchain. The ownership / state of
these names is managed by the BNS smart contract, and can be retrieved / updated by calling the appropriate functions on the contract (e.g. `name-update` or [`name-resolve`](https://github.com/blockstack/stacks-blockchain/blob/master/src/chainstate/stacks/boot/bns.clar#L928)) directly.

Alongside the current owner and the registration / expiry dates, the BNS contract also associates each name  with a corresponding DNS zone file created and published by the name owner (via including a hash of the latest associated zone file in the on-chain name state). The zone file is expected to include a URI resource record which can be used to retrieve the public key associated with the address of the name owner (elaborated on in further sections).

A resolvable Stacks v2 DID can be derived for any existing on-chain name by
concatenating two pieces of information:

- The address of the name owner, e.g. `SP6G7N19FKNW24XH5JQ5P5WR1DN10QWMKMF1WMB3`
- The identifier of the Stacks transaction which registered the
  on-chain name, e.g.
  `d27cb8d9cd4a9f21b1582c5c89a0d303aa613261ad41b729b48bf714f9cd1a02`

The resulting DID -
`did:stacks:v2:SP6G7N19FKNW24XH5JQ5P5WR1DN10QWMKMF1WMB3-d27cb8d9cd4a9f21b1582c5c89a0d303aa613261ad41b729b48bf714f9cd1a02`
contains enough information to map it to the corresponding BNS name, and retrieve and verify the associated public keys (as elaborated on in section 3.3).

## 1.3 Off-chain DIDs

Off-chain DIDs are based on [BNS
subdomains](https://docs.stacks.co/build-apps/references/bns#subdomains), these
are names whose records are stored entirely off-chain, but are collectively anchored to
the blockchain. The ownership and state for these names lives within the P2P
network data. Like their on-chain counterparts, subdomains are globally unique,
strongly owned, and human-readable. BNS gives them their own name state and
public keys. Unlike on-chain names, subdomains can be created and managed
cheaply, because they are broadcast to the BNS network in batches (see section 3.2 for additional details).

An off-chain DID is similarly structured to an on-chain DID. Like on-chain
names, each off-chain name is owned by an address. A resolvable Stacks V2 DID can be derived for any existing off-chain name by concatenating two pieces of information:

- The address of the subdomain owner, e.g.
  `SP6G7N19FKNW24XH5JQ5P5WR1DN10QWMKMF1WMB3`
- The identifier of the Stacks transaction (created by the on-chain name owner)
  which anchored the relevant batch of updates on the Stacks blockchain, e.g.
  `d27cb8d9cd4a9f21b1582c5c89a0d303aa613261ad41b729b48bf714f9cd1a02`.

*The transactionID above is invalid, it's a name update operation for an
on-chain name, not off-chain, TODO update once good example is found*

The resulting did -
`did:stacks:v2:SP6G7N19FKNW24XH5JQ5P5WR1DN10QWMKMF1WMB3-d27cb8d9cd4a9f21b1582c5c89a0d303aa613261ad41b729b48bf714f9cd1a02`
contains enough information to retrieve and verify the public keys associated
with the address during the resolution process (as described in section 3.3).

# 2. Blockstack DID Method

The namestring that shall identify this DID method is: `stack:v2`

A DID that uses this method *MUST* begin with the following literal prefix:
`did:stack:v2`.  The remainder of the DID is its method-specific identifier.

## 2.1 Method-Specific Identifier

The method-specific identifier of the Blockstack DID encodes two pieces of
information:  an address, and a Stacks transaction identifier.

The **address** shall be a base58check encoding of a version byte concatenated
with  the RIPEMD160 hash of a SHA256 hash of a DER-encoded secp256k1 public key.
For example, in this Python 2 snippit:

```python
import hashlib
import base58

pubkey = '042bc8aa4eb54d779c1fb8a2d5022aec8ed7fc2cc34d57356d9e1c417ce416773f45b0299ea7be347d14c69c403d9a03c8ec0ccf47533b4bee8cd002e5de81f945'
sha256_pubkey = hashlib.sha256(pubkey.decode('hex')).hexdigest()
# '18328b13b4df87cbcd190c083ef1d74487fc1383792f208f52c596b4588fb665'
ripemd160_sha256_pubkey = hashlib.new('ripemd160', sha256_pubkey.decode('hex')).hexdigest()
# '1651c1a6001d4750e46be8a02cc19550d4309b71'
version_byte = '\x00'
address = base58.b58check_encode(version_byte + ripemd160_sha256_pubkey.decode('hex'))
# '1331okvQ3Jr2efzaJE42Supevzfzg8ahYW'
```

The **transaction identifier** shall reference a Stacks blockchain transaction
which registered / updated the BNS name associated with the address. The
referenced transaction is expected to encode a `name-register`, `name-update` or
`name-import` call to the BNS smart contract.

## 2.2 Address Encodings
*is this still required? not part of our current implementation, the mainnet
aspect might be relevant*

The address's version byte encodes whether or not a DID corresponds to an
on-chain name transaction or an off-chain name transaction, and whether or not
it corresponds to a mainnet or testnet address.  The version bytes for each
configuration shall be as follows:

* On-chain names on mainnet: `0x00`
* On-chain names on testnet: `0x6f`
* Off-chain names on mainnet: `0x3f`
* Off-chain names on testnet: `0x7f`

For example, the RIPEMD160 hash `1651c1a6001d4750e46be8a02cc19550d4309b71` would
encode to the following base58check strings:

* On-chain mainnet: `1331okvQ3Jr2efzaJE42Supevzfzg8ahYW`
* On-chain testnet: `mhYy6p1NrLHHRnUC1o2QGq2ynzGhduVoEX`
* Off-chain mainnet: `SPL1qbhYmg3EAyn2qf36zoyDamuRXm2Gjk`
* Off-chain testnet: `t8xcrYmzDDhJWihaQWMW2qPZs4Po1PfvCB`

# 3. Blockstack DID Operations

## 3.1 Creating a Blockstack DID

As briefly mentioned in the previous sections, a Stacks v2 DID can be derived from any registered on-chain / off-chain BNS name. 
The process of registering a Stacks v2 DID is therefore reduced to registering the desired underlying BNS name. The following subsections will describe how on-chain, as well as off-chain BNS names can be created.

#### On-chain names

Instantiating an on-chain name requires two calls to the BNS smart contract:

1. First a call to the
   [`name-preorder`](./https://github.com/blockstack/stacks-blockchain/blob/master/src/chainstate/stacks/boot/bns.clar#L581)
   function needs to be made. This transaction commits to a salted hashed name
   and burns the required registration fee (depends on the name / namespace).
2. Once the preorder transaction has been processed and accepted by the network, a call to the
   [`name-register`](.https://github.com/blockstack/stacks-blockchain/blob/master/src/chainstate/stacks/boot/bns.clar#L609/)
   function can be made to finalize the registration process. This transaction
   reveals the salt and the registered name to the network. If the operation
   succeeds, the BNS contract state will be updated  to include a new entry,
   mapping the newly registered name to it's owner's address (hash of the public
   key), as well as the latest zone file hash.

Before the name owner can send out the `name-register` transaction, they need to
create a valid DNS zone file for the BNS name they are registering. The hash of
this zone file will need to be included in the `name-register` transaction as
one of the arguments. More details on the expected contents of the zone file are
included in the next sub-section.

Once both steps have been completed, a resolvable Stacks v2 DID can be derived for the registered name by concatenating the address of the name owner (the sender of the `name-register` transaction), and the identifier of the `name-register` transaction broadcasted in step 2.

A Stacks v2 on-chain DID can be derived this way for any on-chain name (newly registered or already existing).

Blockstack supplies a [reference library](https://github.com/blockstack/stacks.js/tree/master/packages/bns) enabling developers to easily interact with the BNS contract (e.g. to register / update names). For examples on how to use the library to register new names and resolve the corresponding DIDs, consult the [following test helpers](https://github.com/jolocom/Stacks-DID-Resolver/blob/main/src/registrar/index.ts#L277) used by the DID resolver implementation.

#### Off-chain names

An on-chain name (e.g. `example.id`) can have any number of off-chain names
associated with it (e.g. `demo.example.id`), by including the appropriate
records in it's zone file.

Unlike an on-chain name, a subdomain owner needs an on-chain name owner's help
to broadcast their subdomain operations. In particular, a subdomain-creation
transaction can only be processed by the owner of the on-chain name that shares
its suffix. For example, only the owner of `example.id` can broadcast
subdomain-creation transactions for subdomain names ending in `.example.id`.
This is because the zone file related to / describing the subdomain
(`demo.example.id`) is included / nested in the zone file of the name owner
(`example.id`).

To register an off-chain name, the user must submit a request to the
corresponding off-chain registrar. Anyone with an on-chain name can operate such
a registrar.  A reference registrar implementation can be found [here](https://github.com/blockstack/subdomain-registrar).

To register an off-chain DID, the user must submit a JSON body as a HTTP POST
request to the registrar's registration endpoint with the following format:

```
{
   "zonefile": "<zonefile encoding the location of the DDO>",
   "name": "<off-chain name, excluding the on-chain suffix>",
   "owner_address": "<b58check-encoded address that will own the name, with version byte \x00>",
}
```

For example, to register the name `demo` on a registrar for `example.id`:

```bash
$ curl -X POST -H 'Authorization: bearer API-KEY-IF-USED' -H 'Content-Type: application/json' \
> --data '{"zonefile": "$ORIGIN demo\n$TTL 3600\n_https._tcp URI 10 1 \"https://gaia.blockstack.org/hub/1HgW81v6MxGD76UwNbHXBi6Zre2fK8TwNi/profile.json\"\n", \
>          "name": "spqr", \
>          "owner_address": "1HgW81v6MxGD76UwNbHXBi6Zre2fK8TwNi"}' \
> http://localhost:3000/register/
```

The `zonefile` field must be a well-formed DNS zone file, and must have the
following properties (which apply to on-chain names as well):

* It must have its `$ORIGIN` field set to the off-chain name.
* It must have at least one `URI` resource record that encodes an HTTP or HTTPS
  URL.  Note that its name must be either `_http._tcp` or `_https._tcp`, per the
  `URI` record specification.
* The HTTP or HTTPS URL must resolve to a JSON Web token signed by a secp256k1
  public key that hashes to the `owner_address` field, per section 2.1.

Once the registrar receives enough such requests, it can compose a new zone file
which includes all received subdomain opperations. To broadcast the zone file,
the name owner sets the new zone file hash with a `name-update` transaction and
replicates the zone file. This, in turn, replicates all subdomain operations it
contains, and anchors the set of subdomain operations to an on-chain
transaction. The BNS node's consensus rules ensure that only valid subdomain
operations from valid `name-register`, `name-update` or `name-import`
transactions will ever be stored.

Once the transaction confirms and the off-chain zone files are propagated to the
peer network, any Blockstack node will be able to resolve the off-chain name's
associated DID.

A resolvable Stacks v2 DID can be derived for this name by concatenating the address of the subdomain owner, and the identifier of the relevant Stacks transaction broadcasted by the respective name owner.

Just like in the case of on-chain DIDs, a Stacks v2 off-chain DID can be derived this way for any off-chain name (newly registered or already existing). In the current system therefore registering a off-chain BNS name is the only thing required in order to register the corresponding DID.

For additional information on the BNS naming systems, and subdomains, please reffer to the [Blockstack subdomain documentation](https://docs.blockstack.org/core/naming/subdomains.html).


## 3.2 Resolving a Blockstack DID

Resolving Stacks DIDs happens with the aid of the aforementioned BNS smart
contract and the Atlas peer network. The resolution process consists of the
following main steps:

1. Use the data encoded in the Stacks v2 DID to map it to it's corresponding underlying BNS
   name. As mentioned in the previous sections, a Stacks v2 DID can map to an
   on-chain or off-chain name.
2. Ensure that no name revocation operations were broadcasted for the underlying
   BNS name since the creation of the DID. In case the name was revoked, the DID
   is considered deactivated, and the resolution process will fail with the
   corresponding error.
3. Parse and verify any ownership change operations (i.e. `name-transfer` transactions)
   broadcasted for the underlying BNS name since the creation of the DID. These
   operations can be used to rotate the public key(s) associated with a BNS
   name (and by extension the associated DID). The latest valid set of keys will be returned
   once this step completes.

The following sub-sections will elaborate on the individual steps.

### 3.2.1 Mapping a DID to a BNS name

First, the two pieces of information (the ID of the transaction which registered
the name, and the address of the owner) encoded in the method specific
identifier are extracted.

The transaction identifier can be used to query a Stacks node for the full
transaction (e.g. using the [exposed HTTP API
endpoint](https://stacks-node-api.mainnet.stacks.co/extended/v1/tx/0xdb05bd4e09fb29b6c91087aa9af0edeeb9f9f588a74ac64529bee9659c41871b)).

The transaction is expected to list the BNS smart contract as the intended receiver, and encode one of the following contract call(s):
- `name-register` - can be used to register a on-chain or off-chain name (depending on the contents of the associated zone file).
- `name-import` - can be used to register a on-chain or off-chain name (depending on the contents of the associated zone file).
- `name-update`- can be used to register a off-chain name.

All three transactions listed above are expected to include the following function call arguments:
- `name` - the BNS name being registered (e.g. "example").
- `namespace`- the namespace to which the name belongs (e.g. "id").
- `zonefile-hash` - the hash of the latest valid DNS zone file associated with the name.

Before completing this step, the zone file associated with the name needs to be retrieved and parsed. The Atlas peer network can be used to retrieve the zone file using the previously extracted `zonefile-hash`. The retrieved `zonefile` is expected to contain the `$ORIGIN` directive, matching the `name` and `namespace` values extracted in the previous step. In case the zone file is valid, and contains no nested subdomain entries, the DID is mapped to an on-chain name composed of the `name` and `namespace` mentioned above.

The zone file may also include TXT resource records which encode further zone
files associated with subdomains registered under this `name`. Each TXT resource record is expected to include the zone file for the subdomain, as well as the address of the subdomain owner (as documented [here](https://docs.stacks.co/build-apps/references/bns#subdomains)).

In case any of the listed owners matches the address encoded in the DID's NSI, the associated zone file is decoded and parsed. If the zone file is valid, the DID is mapped to the `subdomain` (retreved from teh zone file), `name` and `namespace` (e.g. extracted from the registration transaction).

**Retrieving the public key for a BNS name**

The DNS zone file associated with a BNS name is expected to include at least one `URI` resource record that encodes an HTTP or HTTPS URL. The URL is expected to point to a JSON Web Token signed using the key of the current BNS name owner. The JWT is also expected to include the secp256k1 public key, which can be used to verify the JWT signature. The resolver needs to make sure that the signature verifies correctly, and that the included public key correctly correctly maps to the Stacks address of the name owner.

Any time a BNS name is updated, a new zone file can be assembled and published. Older zone files are not discarded, and can be retrieved at any point using the appropriate `zonefile-hash`. 

### 3.2.2 Ensuring the DID is not deactivated

Once the DID has been mapped to a valid BNS name, a number of post-resolution steps take place. Before the resolution process can continue, the resolver needs to ensure that the DID being resolved has not been deactivated. As described in a later section (3.4), in order to deactivate a DID, the user needs to revoke the underlying BNS name.

At this stage, the resolver needs to ensure that the BNS name underpinning the DID has not been revoked. The BNS contract can be queried for the latest state associated with a name. The returned response will contain a number of fields describing the name (e.g. current owner, zone file hash, registration and expiry times, status, etc.). 

At this stage the `status` property is relevant. It is expected to list the latest operation performed on a name.
In case the `status` property is set to `name-revoke`, the DID is considered deactivated. (an on-chain BNS name which was once revoked can not be registered again at a later point, i.e. the status can not be changed from `name-revoke`).

### 3.2.3 Resolving the DID to the latest set of keys

The last step in the resolution process is mapping the BNS name (and by
extension DID) to it's latest owner and set of public keys. As described in
section 3.3, the keys associated with a DID can be rotated after the DID's
creation, e.g. by issuing a `name-transfer` operation designating a new owner
for the underlying on-chain BNS name. 

At this stage, the BNS contract can be queried for the current owner associated
with the BNS name. If the owner has changed since the DID was created, the new
public key needs to be retrieved and verified. 

The process for retrieving the key is simillar to the one described in section
3.2.1, namely it consists of fetching the latest zone file for the BNS name,
finding the relevant `URI` resource record, fetching the referenced signed JSON
Web Token , verifying the signature and the included public key(s), and finally
returning the latest valid public key(s) for the name.

In case no ownership transfer operations were issued for the DID / BNS name, we
continue to step 3.2.4 with the original public key(s) retrieved in step 3.2.1.

### 3.2.4  Generating a DID Document for a Stacks v2 DID

As previously mentioned, the resolution process consists of mapping a DID to a set of active signing keys via the underlying BNS name. Once the steps outlined above complete, the resolved public key(s), alongside the DID can be used to generate a well-formed DID Document "on the fly" and return it to the client.

## 3.3 Updating a Blockstack DID

A user can rotate the keys associated with their on-chain BNS name / DID by
transferring the ownership of the name to a different address. In order to
accomplish this for an on-chain name, the user must broadcast a `name-transfer`
transaction to send the name to a new address.  Once the transaction is
confirmed by the Stacks network, the DID's public key will be updated.

Blockstack supplies a [reference library](https://github.com/blockstack/stacks.js/tree/master/packages/bns) enabling developers to easily interact with the BNS contract in order to transfer a BNS name. For examples on how to use the library to update a on-chain Stacks v2 DIDs, consult the [following test helpers](https://github.com/jolocom/Stacks-DID-Resolver/blob/main/src/registrar/index.ts#L171) used by the DID resolver implementation.

### 3.3.1 Updating an off-chain DID

If the DID corresponds to an off-chain name, then the user must request that the
registrar that instantiated the name broadcasts an off-chain name transfer
operation.  To do so, the user must submit a string with the following format to
the registrar:

```
${name} TXT "owner=${new_address}" "seqn=${update_counter}" "parts=${length_of_zonefile_base64}" "zf0=${base64_part_0}" "zf1=${base64_part_1}" ... "sig=${base64_signature}"
```

The string is a well-formed DNS TXT record with the following fields:

* The `${name}` field is the subdomain name without the on-chain suffix (e.g.
  `spqr` in `spqr.res_publica.id`.
* The `${new_address}` field is the new owner address of the subdomain name.
* The `${update_counter}` field is a non-negative integer equal to the number of
  subdomain name operations that have occurred so far.  It starts with 0 when
  the name is created, and must increment each time the name owner issues an
  off-chain name operation.
* The `${length_of_zonefile_base64}` field is equal to the length of the
  base64-encoded zone file for the off-chain name.
* The fields `zf0`, `zf1`, `zf2`, etc. and their corresponding variables
  `${base64_part_0}`, `${base64_part_1}`, `${base64_part_2}`, etc. correspond to
  256-byte segments of the base64-encoded zone file.  They must occur in a
  sequence of `zf${n}` where `${n}` starts at 0 and increments by 1 until all
  segments of the zone file are represented.
* The `${base64_signature}` field is a secp256k1 signature over the resulting
  string, up to the `sig=` field, and base64-encoded.  The signature must come
  from the secp256k1 private key that currently owns the name.

Thus to generate this TXT record for their DID, the user would do the following:

1. Base64-encode the off-chain DID's zone file.
2. Break the base64-encoded zone file into 256-byte segments.
3. Assemble the TXT record from the name, new address, update counter, and zone
   file segments.
4. Sign the resulting string with the DID's current private key.
5. Generate and append the `sig=${base64_signature}` field to the TXT record.

Sample code to generate these TXT records can be found in the [Blockstack Core
reference implementation](https://github.com/blockstack/blockstack-core), under
the `blockstack.lib.subdomains` package.  For example, the Python 2 program here
generates such a TXT record:

```python
import blockstack

offchain_name = 'bar'
onchain_name = 'foo.test'
new_address = '1Jq3x8BAYz9Xy9AMfur5PXkDsWtmBBsNnC'
seqn = 1
privk = 'da1182302fee950e64241a4103646992b1bed7f6c4ced858282e493d57df33a501'
full_name = '{}.{}'.format(offchain_name, onchain_name)
zonefile = "$ORIGIN {}\n$TTL 3600\n_http._tcp\tIN\tURI\t10\t1\t\"https://gaia.blockstack.org/hub/{}/profile.json\"\n\n".format(offchain_name, new_address)

print blockstack.lib.subdomains.make_subdomain_txt(full_name, onchain_name, new_address, seqn, zonefile, privk)
```

The program prints a string such as:
```
bar TXT "owner=1Jq3x8BAYz9Xy9AMfur5PXkDsWtmBBsNnC" "seqn=1" "parts=1" "zf0=JE9SSUdJTiBiYXIKJFRUTCAzNjAwCl9odHRwLl90Y3AJSU4JVVJJCTEwCTEJImh0dHBzOi8vZ2FpYS5ibG9ja3N0YWNrLm9yZy9odWIvMUpxM3g4QkFZejlYeTlBTWZ1cjVQWGtEc1d0bUJCc05uQy9wcm9maWxlLmpzb24iCgo\=" "sig=QEA+88Nh6pqkXI9x3UhjIepiWEOsnO+u1bOBgqy+YyjrYIEfbYc2Q8YUY2n8sIQUPEO2wRC39bHQHAw+amxzJfkhAxcC/fZ0kYIoRlh2xPLnYkLsa5k2fCtXqkJAtsAttt/V"
```

(Note that the `sig=` field will differ between invocations, due to the way
ECDSA signatures work).

Once this TXT record has been submitted to the name's original registrar, the
registrar will pack it along with other such records into a single zone file,
and issue a `name-update` transaction for the on-chain name to announce them to
the rest of the peer network.  The registrar will then propagate these TXT
records to the peer network once the transaction confirms, thereby informing all
Blockstack nodes of the new state of the off-chain DID.

## 3.4 Deactivating a Stacks v2 DID

If the user wants to deactivate their DID, they can do so by revoking the underlying
BNS name.  To do this with an on-chain name, the owner can construct and broadcast a
[`name-revoke`](https://github.com/blockstack/stacks-blockchain/blob/master/src/chainstate/stacks/boot/bns.clar#L712) transaction. Once the transaction has been confirmed, the BNS contract state will be updated to list the corresponding on-chain name as revoked. Attempting to resolve a Stacks V2 DID based on a revoked name will result in an error. It is also worth mentioning that once a name has been revoked, there's no way to associate a new owner / re-register it in the future, thus the underlying DID will be remain deactivated forever.

In order to deactivate an off-chain name, the user can construct and broadcasts a TXT
record for their DID's underlying name that (1) changes the owner address to a
"nothing-up-my-sleeve" address (such as `1111111111111111111114oLvT2` -- the
base58-check encoding of 20 bytes of 0's), and (2) changes the zone file to
include an unresolvable URL.  This prevents the DID from resolving, and prevents
it from being updated.

# 4. Security Considerations

This section briefly outlines possible ways to attack Blockstack's DID method,
as well as countermeasures the Blockstack protocol and the user can take to
defend against them.

## 4.1 Public Blockchain Attacks

Blockstack operates on top of a public blockchain, which could be attacked by a
sufficiently pwowerful adversary -- such as rolling back and changing the
chain's transaction history, denying new transactions for Blockstack's name
operations, or eclipsing nodes.

Blockstack makes the first two attacks difficult by operating on top of the most
secure blockchain -- currently Bitcoin.  If the blockchain is attacked, or a
stronger blockchain comes into being, the Blockstack community would migrate the
Blockstack network to a new blockchain.

The underlying blockchain provides some immunity towards eclipse attacks, since
a blockchain peer expects blocks to arrive at roughly fixed intervals and
expects blocks to have a proof of an expenditure of an expensive resource (like
electricity).  In Bitcoin's case, the computational difficulty of finding new
blocks puts a high lower bound on the computational effort required to eclipse a
Bitcoin node -- in order to sustain 10-minute block times, the attacker must
expend an equal amount of energy as the rest of the network.  Moreover, the
required expenditure rate (the "chain difficulty") decreases slowly enough that
an attacker with less energy would have to spend months of time on the attack,
giving the victim ample time to detect it.  The countermeasures the blockchain
employs to deter eclipse attacks are beyond the scope of this document, but it
is worth pointing out that Blockstack's DID method benefits from them since they
also help ensure that DID creation, updates and deletions get processed in a
timely manner.

## 4.2 Blockstack Peer Network Attacks

Because Blockstack stores each DID's DDO's URL in its own peer network outside
of its underlying blockchain, it is possible to eclipse Blockstack nodes and
prevent them from seeing both off-chain DID operations and updates to on-chain
DIDs.  In an effort to make this as difficult as possible, the Blockstack peer
network implements an unstructured overlay network -- nodes select a random
sample of the peer graph as their neighbors.  Moreover, Blockstack nodes strive
to fetch a full replica of all zone files, and pull zone files from their
neighbors in rarest-first order to prevent zone files from getting lost while
they are propagating.  This makes eclipsing a node maximally difficult -- an
attacker would need to disrupt all of a the victim node's neighbor links.

In addition to this protocol-level countermeasure, a user has the option of
uploading zone files manually to their preferred Blockstack nodes.  If  vigilent
users have access to a replica of the zone files, they can re-seed Blockstack
nodes that do not have them.

## 4.3 Stale Data and Replay Attacks

A DID's DDO is stored on a 3rd party storage provider.  The DDO's public key is
anchored to the blockchain, which means each time the DDO public key changes,
all previous DDOs are invalidated.  Similarly, the DDO's storage provider URLs
are anchored to the blockchain, which means each time the DID's zone file
changes, any stale DDOs will no longer be fetched.  However, if the user changes
other fields of their DDO, a malicious storage provider or a network adversary
can serve a stale but otherwise valid DDO and the resolver will accept it.

The user has a choice of which storage providers host their DDO.  If the storage
provider serves stale data, the user can and should change their storage
provider to one that will serve only fresh data.  In addition, the user should
use secure transport protocols like HTTPS to make replay attacks on the network
difficult.  For use cases where these are not sufficient to prevent replay
attacks, the user should change their zone file and/or public key each time they
change their DDO.

# 5. Privacy Considerations

Blockstack's DIDs are underpinned by Blockstack IDs (human readable names), and
every Blockstack node records where every DID's DDO is hosted.  However, users
have the option of encrypting their DDOs so that only a select set of other
users can decrypt them.

Blockstack's peer network and DID resolver use HTTP(S), meaning that
intermediate middleboxes like CDNs and firewalls can cache data and log
requests.

# 6.  Reference Implementations

Blockstack implements a [RESTful API](https://core.blockstack.org) for querying
DIDs.  It also implements a [reference
library](https://github.com/blockstack/blockstack.js) for generating well-formed
on-chain transactions, and it implements a [Python
library](https://github.com/blockstack/blockstack/core/blob/master/blockstack/lib/subdomains.py)
for generating off-chain DID operations.  The Blockstack node [reference
implementation](https://github.com/blockstack/blockstack-core) is available
under the terms of the General Public Licence, version 3.

# 7.  Resources

Many Blockstack developers communicate via the [Blockstack
Forum](https://forum.blockstack.org) and via the [Blockstack
Slack](https://blockstack.slack.com).  Interested developers are encouraged to
join both.

# Appendix A: On-chain Wire Formats

This section is for organizations who want to be able to create and send name
operation transactions to the blockchain(s) Blockstack supports.  It describes
the transaction formats for the Bitcoin blockchain.

Only the transactions that affect DID creation, updates, resolution, and
deletions are documented here.  A full listing of all Blockstack transaction
formats can be found
[here](https://github.com/blockstack/blockstack-core/blob/master/docs/wire-format.md).

## Transaction format

Each Bitcoin transaction for Blockstack contains signatures from two sets of
keys: the name owner, and the payer.  The owner `scriptSig` and `scriptPubKey`
fields are generated from the key(s) that own the given name.  The payer
`scriptSig` and `scriptPubKey` fields are used to *subsidize* the operation.
The owner keys do not pay for any operations; the owner keys only control the
minimum amount of BTC required to make the transaction standard.  The payer keys
only pay for the transaction's fees, and (when required) they pay the name fee.

This construction is meant to allow the payer to be wholly separate from the
owner.  The principal that owns the name can fund their own transactions, or
they can create a signed transaction that carries out the desired operation and
request some other principal (e.g. a parent organization) to actually pay for
and broadcast the transaction.

The general transaction layout is as follows:

| **Inputs**               | **Outputs**            |
| ------------------------ | ----------------------- |
| Owner scriptSig (1)      | `OP_RETURN <payload>` (2)  |
| Payment scriptSig        | Owner scriptPubKey (3) |
| Payment scriptSig... (4) |
| ...                  (4) | ... (5)                |

(1) The owner `scriptSig` is *always* the first input.  (2) The `OP_RETURN`
script that describes the name operation is *always* the first output.  (3) The
owner `scriptPubKey` is *always* the second output.  (4) The payer can use as
many payment inputs as (s)he likes.  (5) At most one output will be the "change"
`scriptPubKey` for the payer.  Different operations require different outputs.

## Payload Format

Each Blockstack transaction in Bitcoin describes the name operation within an
`OP_RETURN` output.  It encodes name ownership, name fees, and payments as
`scriptPubKey` outputs.  The specific operations are described below.

Each `OP_RETURN` payload *always* starts with the two-byte string `id` (called
the "magic" bytes in this document), followed by a one-byte `op` that describes
the operation.

### NAME_PREORDER

Op: `?`

Description:  This transaction commits to the *hash* of a name.  It is the first
transaction of two transactions that must be sent to register a name in BNS.

Example:
[6730ae09574d5935ffabe3dd63a9341ea54fafae62fde36c27738e9ee9c4e889](https://www.blocktrail.com/BTC/tx/6730ae09574d5935ffabe3dd63a9341ea54fafae62fde36c27738e9ee9c4e889)

`OP_RETURN` wire format:
```
    0     2  3                                                  23             39
    |-----|--|--------------------------------------------------|--------------|
    magic op  hash_name(name.ns_id,script_pubkey,register_addr)   consensus hash
```

Inputs:
* Payment `scriptSig`'s

Outputs:
* `OP_RETURN` payload
* Payment `scriptPubkey` script for change
* `p2pkh` `scriptPubkey` to the burn address
  (0x00000000000000000000000000000000000000)

Notes:
* `register_addr` is a base58check-encoded `ripemd160(sha256(pubkey))` (i.e. an
  address).  This address **must not** have been used before in the underlying
  blockchain.
* `script_pubkey` is either a `p2pkh` or `p2sh` compiled Bitcoin script for the
  payer's address.

### NAME_REGISTRATION

Op: `:`

Description:  This transaction reveals the name whose hash was announced by a
previous `NAME_PREORDER`.  It is the second of two transactions that must be
sent to register a name in BNS.

When this transaction confirms, the corresponding Blockstack DID will be
instantiated.  It's address will be the owner address in this transaction, and
its index will be equal to the number of names registered to this address
previously.

Example:
[55b8b42fc3e3d23cbc0f07d38edae6a451dfc512b770fd7903725f9e465b2925](https://www.blocktrail.com/BTC/tx/55b8b42fc3e3d23cbc0f07d38edae6a451dfc512b770fd7903725f9e465b2925)

`OP_RETURN` wire format (2 variations allowed):

Variation 1:
```
    0    2  3                             39
    |----|--|-----------------------------|
    magic op   name.ns_id (37 bytes)
```

Variation 2:
```
    0    2  3                                  39                  59
    |----|--|----------------------------------|-------------------|
    magic op   name.ns_id (37 bytes, 0-padded)       value
```

Inputs:
* Payer `scriptSig`'s

Outputs:
* `OP_RETURN` payload
* `scriptPubkey` for the owner's address
* `scriptPubkey` for the payer's change

Notes:

* Variation 1 simply registers the name.  Variation 2 will register the name and
set a name value simultaneously.  This is used in practice to set a zone file
hash for a name without the extra `NAME_UPDATE` transaction.
* Both variations are supported.  Variation 1 was designed for the time when
  Bitcoin only supported 40-byte `OP_RETURN` outputs.

### NAME_RENEWAL

Op: `:`

Description:  This transaction renews a name in BNS.  The name must still be
registered and not expired, and owned by the transaction sender.

Depending on which namespace the name was created in, you may never need to
renew a name.  However, in namespaces where names expire (such as `.id`), you
will need to renew your name periodically to continue using its associated DID.
If this is a problem, we recommend creating a name in a namespace without name
expirations, so that `NAME_UPDATE`, `NAME_TRANSFER` and `NAME_REVOKE` -- the
operations that underpin the DID's operations -- will work indefinitely.

Example:
[e543211b18e5d29fd3de7c0242cb017115f6a22ad5c6d51cf39e2b87447b7e65](https://www.blocktrail.com/BTC/tx/e543211b18e5d29fd3de7c0242cb017115f6a22ad5c6d51cf39e2b87447b7e65)

`OP_RETURN` wire format (2 variations allowed):

Variation 1:
```
    0    2  3                             39
    |----|--|-----------------------------|
    magic op   name.ns_id (37 bytes)
```

Variation 2:
```
    0    2  3                                  39                  59
    |----|--|----------------------------------|-------------------|
    magic op   name.ns_id (37 bytes, 0-padded)       value
```

Inputs:

* Payer `scriptSig`'s

Outputs:

* `OP_RETURN` payload
* `scriptPubkey` for the owner's addess.  This can be a different address than
  the current name owner (in which case, the name is renewed and transferred).
* `scriptPubkey` for the payer's change
* `scriptPubkey` for the burn address (to pay the name cost)

Notes:

* This transaction is identical to a `NAME_REGISTRATION`, except for the
  presence of the fourth output that pays for the name cost (to the burn
  address).
* Variation 1 simply renews the name.  Variation 2 will both renew the name and
  set a new name value (in practice, the hash of a new zone file).
* Both variations are supported.  Variation 1 was designed for the time when
  Bitcoin only supported 40-byte `OP_RETURN` outputs.
* This operation can be used to transfer a name to a new address by setting the
  second output (the first `scriptPubkey`) to be the `scriptPubkey` of the new
  owner key.

### NAME_UPDATE

Op: `+`

Description:  This transaction sets the name state for a name to the given
`value`.  In practice, this is used to announce new DNS zone file hashes to the
[Atlas network](https://docs.blockstack.org/core/atlas/overview.html), and in
doing so, change where the name's off-chain state resides.  In DID terminology,
this operation changes where the authoritative replica of the DID's DDO will be
retrieved on the DID's lookup.

Example:
[e2029990fa75e9fc642f149dad196ac6b64b9c4a6db254f23a580b7508fc34d7](https://www.blocktrail.com/BTC/tx/e2029990fa75e9fc642f149dad196ac6b64b9c4a6db254f23a580b7508fc34d7)

`OP_RETURN` wire format:
```
    0     2  3                                   19                      39
    |-----|--|-----------------------------------|-----------------------|
    magic op  hash128(name.ns_id,consensus hash)      zone file hash
```

Note that `hash128(name.ns_id, consensus hash)` is the first 16 bytes of a
SHA256 hash over the name concatenated to the hexadecimal string of the
consensus hash (not the bytes corresponding to that hex string).  See the
[Method Glossary](#method-glossary) below.

Example: `hash128("jude.id" + "8d8762c37d82360b84cf4d87f32f7754") ==
"d1062edb9ec9c85ad1aca6d37f2f5793"`.

The 20 byte zone file hash is computed from zone file data by using
`ripemd160(sha56(zone file data))`

Inputs:
* owner `scriptSig`
* payment `scriptSig`'s

Outputs:
* `OP_RETURN` payload
* owner's `scriptPubkey`
* payment `scriptPubkey` change

### NAME_TRANSFER

Op: `>`

Description:  This transaction changes the public key hash that owns the name in
BNS.  When the name or its DID is looked up after this transaction confirms, the
resolver will list the new public key as the owner.

Example:
[7a0a3bb7d39b89c3638abc369c85b5c028d0a55d7804ba1953ff19b0125f3c24](https://www.blocktrail.com/BTC/tx/7a0a3bb7d39b89c3638abc369c85b5c028d0a55d7804ba1953ff19b0125f3c24)

`OP_RETURN` wire format:
```
    0     2  3    4                   20              36
    |-----|--|----|-------------------|---------------|
    magic op keep  hash128(name.ns_id) consensus hash
             data?
```

Inputs:

* Owner `scriptSig`
* Payment `scriptSig`'s

Outputs:

* `OP_RETURN` payload
* new name owner's `scriptPubkey`
* old name owner's `scriptPubkey`
* payment `scriptPubkey` change

Notes:

* The `keep data?` byte controls whether or not the name's 20-byte value is
preserved (i.e. whether or not the name's associated zone file is preserved
across the transfer).  This value is either `>` to preserve it, or `~` to delete
it.  If you're simply re-keying, you should use `>`.  You should only use `~` if
you want to simultaneously dissociate the name (and its DID) from its off-chain
state, like the DID's DDO.

### NAME_REVOKE

Op: `~`

Description:  This transaction destroys a registered name.  Its name state value
in BNS will be cleared, and no further transactions will be able to affect the
name until it expires (if its namespace allows it to expire at all).  Once
confirmed, this transaction ensures that neither the name nor the DID will
resolve to a DDO.

Example:
[eb2e84a45cf411e528185a98cd5fb45ed349843a83d39fd4dff2de47adad8c8f](https://www.blocktrail.com/BTC/tx/eb2e84a45cf411e528185a98cd5fb45ed349843a83d39fd4dff2de47adad8c8f)

`OP_RETURN` wire format:
```
    0    2  3                             39
    |----|--|-----------------------------|
    magic op   name.ns_id (37 bytes)
```

Inputs:

* owner `scriptSig`
* payment `scriptSig`'s

Outputs:

* `OP_RETURN` payload
* owner `scriptPubkey`
* payment `scriptPubkey` change

## Method Glossary

Some hashing primitives are used to construct the wire-format representation of
each name operation.  They are enumerated here:

```
B40_REGEX = '^[a-z0-9\-_.+]*$'

def is_b40(s):
    return isinstance(s, str) and re.match(B40_REGEX, s) is not None

def b40_to_bin(s):
    if not is_b40(s):
        raise ValueError('{} must only contain characters in the b40 char set'.format(s))
    return unhexlify(charset_to_hex(s, B40_CHARS))

def hexpad(x):
    return ('0' * (len(x) % 2)) + x

def charset_to_hex(s, original_charset):
    return hexpad(change_charset(s, original_charset, B16_CHARS))

def bin_hash160(s, hex_format=False):
    """ s is in hex or binary format
    """
    if hex_format and is_hex(s):
        s = unhexlify(s)
    return hashlib.new('ripemd160', bin_sha256(s)).digest()

def hex_hash160(s, hex_format=False):
    """ s is in hex or binary format
    """
    if hex_format and is_hex(s):
        s = unhexlify(s)
    return hexlify(bin_hash160(s))

def hash_name(name, script_pubkey, register_addr=None):
    """
    Generate the hash over a name and hex-string script pubkey.
    Returns the hex-encoded string RIPEMD160(SHA256(x)), where
    x is the byte string composed of the concatenation of the
    binary
    """
    bin_name = b40_to_bin(name)
    name_and_pubkey = bin_name + unhexlify(script_pubkey)

    if register_addr is not None:
        name_and_pubkey += str(register_addr)

    # make hex-encoded hash
    return hex_hash160(name_and_pubkey)

def hash128(data):
    """
    Hash a string of data by taking its 256-bit sha256 and truncating it to the
    first 16 bytes
    """
    return hexlify(bin_sha256(data)[0:16])
```

