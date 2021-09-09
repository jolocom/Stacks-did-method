# Stacks DID Method
This repository includes the `did:stack:v2` [DID method specification document](./docs/DID_Method_Spec.md),
a Typescript module enabling developers to easily resolve `did:stacks:v2` identifiers to their corresponding DID Documents, as well as an integration with the DIF Universal Resolver project. Further, `package` specific documentation is included in the corresponding folders.

# Contents:

The [packages](./packages/) directory contains the following modules:

- [did-resolver](./packages/did-resolver): The implementation a DID resolver for `did:stack:v2` identifiers. The package also includes a set of unit / integration tests, and further documentation on how to install / build / test and use the provided module.

- [universal-resolver-driver](./packages/universal-resolver-driver): `did:stack:v2` integration for the [DIF Universal Resolver](https://github.com/decentralized-identity/universal-resolver) project.

The DID method specification, the resolver package, as well as the integrations hosted in this repository were developed as part of the [following grant from the Stacks foundation](https://github.com/stacksgov/Stacks-Grants/issues/61). 
