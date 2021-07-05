"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentBlockNumber = exports.fetchAllNames = exports.fetchSignedToken = exports.fetchTransactionById = exports.fetchNameInfo = exports.fetchNamesOwnedByAddress = exports.fetchZoneFileForName = void 0;
require("isomorphic-fetch");
const ramda_1 = require("ramda");
const fluture_1 = require("fluture");
const general_1 = require("./utils/general");
const constants_1 = require("./constants");
const transactions_1 = require("@stacks/transactions");
const monet_1 = require("monet");
const fetchJSON = (endpoint) => {
    return fluture_1.encaseP(() => fetch(endpoint).then((res) => res.json()))(endpoint);
};
/**
 * Given a on-chain BNS name, will return the latest zonefile associated with it.
 * @param {String} name - the BNS name for which the zonefile will be retrieved
 * @param {String} namespace - the BNS namespace to which the BNS name belongs
 *
 * @returns {FutureInstance<Error ,String>} which resolves to the zonefile, as a string
 */
const fetchZoneFileForName = (apiEndpoint) => (args) => {
    const fqn = general_1.encodeFQN({ name: args.name, namespace: args.namespace });
    const endpoint = `${apiEndpoint}/v1/names/${fqn}/zonefile/${args.zonefileHash || ""}`;
    return fetchJSON(endpoint).pipe(fluture_1.map(ramda_1.prop("zonefile")));
};
exports.fetchZoneFileForName = fetchZoneFileForName;
/**
 * Given a Stacks Address, will return an array of BNS names owned by it.
 * @param {String} address - a c32 encoded Stacks Address
 *
 * @returns {FutureInstance<Error, String[]>} - an array of names owned by the address.
 */
const fetchNamesOwnedByAddress = (apiEndpoint) => (address) => fetchJSON(`${apiEndpoint}/v1/addresses/stacks/${address}`)
    .pipe(fluture_1.map(ramda_1.prop("names")))
    .pipe(fluture_1.chain((names) => (names === null || names === void 0 ? void 0 : names.length) > 0
    ? fluture_1.resolve(names)
    : fluture_1.reject(new Error("No names associated with DID"))));
exports.fetchNamesOwnedByAddress = fetchNamesOwnedByAddress;
/**
 * Will query a Stacks node for the latest state associated with a BNS name
 * @param {String} name - the BNS name for which the zonefile will be retrieved
 * @param {String} namespace - the BNS namespace to which the BNS name belongs
 *
 * @returns {NameInfo} - the name state received from the BNS contract / Stacks node
 */
const fetchNameInfo = (network) => ({ name, namespace, }) => {
    const endpoint = `${network.coreApiUrl}/v1/names/${general_1.encodeFQN({ name, namespace })}`;
    return fetchJSON(endpoint).pipe(fluture_1.chain((res) => {
        return fetchNameInfoFromContract({
            name,
            namespace,
            network,
        }).pipe(fluture_1.map(someResult => someResult.map(({ address, zonefile_hash }) => {
            if (general_1.stripHexPrefixIfPresent(zonefile_hash) ===
                general_1.stripHexPrefixIfPresent(res.zonefile_hash)) {
                return Object.assign(Object.assign({}, res), { address });
            }
            return res;
        }).cata(() => res, ramda_1.identity)));
    }));
};
exports.fetchNameInfo = fetchNameInfo;
/**
 * Will query a the BNS contract directly for the latest state associated with a BNS name
 * @param {String} name - the BNS name for which the state should be retrieved
 * @param {String} namespace - the BNS namespace to which the BNS name belongs
 * @param {StacksNetwork} network - the Stacks deployment / network to use
 *
 * @returns {Maybe<NameInfo>} - the name state received from the BNS contract / Stacks node
 */
const fetchNameInfoFromContract = ({ name, namespace, network, }) => {
    const bnsDeployment = network.isMainnet() ? constants_1.BNS_ADDRESSES.main : constants_1.BNS_ADDRESSES.test;
    const [contractAddress, contractName] = bnsDeployment.split('.');
    // TODO Use randomly generated addr every time?
    const senderAddress = "ST2F4BK4GZH6YFBNHYDDGN4T1RKBA7DA1BJZPJEJJ";
    const options = {
        contractAddress,
        contractName,
        functionName: 'name-resolve',
        functionArgs: [transactions_1.bufferCVFromString(namespace), transactions_1.bufferCVFromString(name)],
        network,
        senderAddress,
    };
    return fluture_1.encaseP(transactions_1.callReadOnlyFunction)(options).pipe(fluture_1.chain((result) => {
        const { value, success } = transactions_1.cvToJSON(result);
        if (!success) {
            return fluture_1.resolve(monet_1.None());
        }
        return fluture_1.resolve(monet_1.Some({
            zonefile_hash: value.value["zonefile-hash"].value,
            address: value.value.owner.value,
        }));
    }));
};
/**
 * Given a Stacks transaction ID, will attempt to retrieve the corresponding transaction
 * from a Stacks blockchain node
 * @param {String} txId - the Stacks transaction identifier
 *
 * @returns the corresponding stacks transaction if found
 */
const fetchTransactionById = (apiEndpoint) => (txId) => {
    const endpoint = `${apiEndpoint}/extended/v1/tx/${txId}?event_offset=0&event_limit=96`;
    return fetchJSON(endpoint).pipe(fluture_1.chain((res) => {
        if (res.tx_id && res.tx_status) {
            return fluture_1.resolve(res);
        }
        return fluture_1.reject(new Error(res.error));
    }));
};
exports.fetchTransactionById = fetchTransactionById;
const fetchSignedToken = (endpoint) => fetchJSON(endpoint).pipe(fluture_1.map((el) => el[0]));
exports.fetchSignedToken = fetchSignedToken;
const fetchAllNames = (apiEndpoint) => (page = 0) => fetchJSON(`${apiEndpoint}/v1/names?page=${page}`);
exports.fetchAllNames = fetchAllNames;
const getCurrentBlockNumber = (apiEndpoint) => fetchJSON(`${apiEndpoint}/v2/info`).pipe(fluture_1.map(ramda_1.prop("stacks_tip_height")));
exports.getCurrentBlockNumber = getCurrentBlockNumber;
//# sourceMappingURL=api.js.map