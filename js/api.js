"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentBlockNumber = exports.fetchAllNames = exports.fetchSignedToken = exports.fetchTransactionById = exports.fetchNameInfoFromContract = exports.fetchNameInfo = exports.fetchNamesOwnedByAddress = exports.fetchZoneFileForName = void 0;
require("isomorphic-fetch");
const ramda_1 = require("ramda");
const fluture_1 = require("fluture");
const general_1 = require("./utils/general");
const constants_1 = require("./constants");
const transactions_1 = require("@stacks/transactions");
const network_1 = require("@stacks/network");
const HOST = "http://localhost:3999";
// const HOST = 'https://stacks-node-api.mainnet.stacks.co'
const postJSON = (endpoint, data) => {
    return fluture_1.encaseP(() => fetch(endpoint, {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
            "Content-Type": "application/json",
        },
    }).then((res) => res.json()))(endpoint);
};
const fetchJSON = (endpoint) => {
    return fluture_1.encaseP(() => fetch(endpoint).then((res) => res.json()))(endpoint);
};
const fetchZoneFileForName = (args) => {
    const fullName = general_1.encodeFQN({ name: args.name, namespace: args.namespace });
    const endpoint = `${HOST}/v1/names/${fullName}/zonefile/${args.zonefileHash || ""}`;
    return fetchJSON(endpoint).pipe(fluture_1.map(ramda_1.prop("zonefile")));
};
exports.fetchZoneFileForName = fetchZoneFileForName;
const fetchNamesOwnedByAddress = (address, blockChain = "stacks") => {
    return fetchJSON(`${HOST}/v1/addresses/${blockChain}/${address}`)
        .pipe(fluture_1.map(ramda_1.prop("names")))
        .pipe(fluture_1.chain((names) => (names === null || names === void 0 ? void 0 : names.length) > 0
        ? fluture_1.resolve(names)
        : fluture_1.reject(new Error("No names associated with DID"))));
};
exports.fetchNamesOwnedByAddress = fetchNamesOwnedByAddress;
const fetchNameInfo = ({ name, namespace, }) => {
    const endpoint = `${HOST}/v1/names/${general_1.encodeFQN({ name, namespace })}`;
    return fetchJSON(endpoint).pipe(fluture_1.chain((res) => {
        return exports.fetchNameInfoFromContract({
            name,
            namespace,
            network: new network_1.StacksMocknet(),
        }).pipe(fluture_1.map(({ address, zonefile_hash }) => {
            if (general_1.stripHexPrefixIfPresent(zonefile_hash) ===
                general_1.stripHexPrefixIfPresent(res.zonefile_hash)) {
                return Object.assign(Object.assign({}, res), { address });
            }
            return res;
        }));
    }));
};
exports.fetchNameInfo = fetchNameInfo;
const fetchNameInfoFromContract = ({ name, namespace, network, }) => {
    const [contractAddress, contractName] = constants_1.BNS_ADDRESSES.test.split(".");
    const functionName = "name-resolve";
    // TODO Use randomly generated addr every time?
    const senderAddress = "ST2F4BK4GZH6YFBNHYDDGN4T1RKBA7DA1BJZPJEJJ";
    const options = {
        contractAddress,
        contractName,
        functionName,
        functionArgs: [transactions_1.bufferCVFromString(namespace), transactions_1.bufferCVFromString(name)],
        network,
        senderAddress,
    };
    //@ts-ignore
    return fluture_1.encaseP(transactions_1.callReadOnlyFunction)(options).pipe(fluture_1.chain((result) => {
        const { value, success } = transactions_1.cvToJSON(result);
        if (!success) {
            return fluture_1.resolve({
                zonefile_hash: "0",
            });
        }
        return fluture_1.resolve({
            zonefile_hash: value.value["zonefile-hash"].value,
            address: value.value.owner.value,
        });
    }));
};
exports.fetchNameInfoFromContract = fetchNameInfoFromContract;
const fetchTransactionById = (txId) => {
    const endpoint = `${HOST}/extended/v1/tx/${txId}?event_offset=0&event_limit=96`;
    return fetchJSON(endpoint).pipe(fluture_1.chain((res) => {
        if (res.tx_id && res.tx_status) {
            return fluture_1.resolve(res);
        }
        return fluture_1.reject(new Error(res.error));
    }));
};
exports.fetchTransactionById = fetchTransactionById;
const fetchSignedToken = (endpoint) => {
    return fetchJSON(endpoint).pipe(fluture_1.map((el) => el[0]));
};
exports.fetchSignedToken = fetchSignedToken;
const fetchAllNames = (page = 0) => {
    return fetchJSON(`${HOST}/v1/names?page=${page}`);
};
exports.fetchAllNames = fetchAllNames;
const getCurrentBlockNumber = () => {
    return fetchJSON(`${HOST}/v2/info`).pipe(fluture_1.map(ramda_1.prop("stacks_tip_height")));
};
exports.getCurrentBlockNumber = getCurrentBlockNumber;
//# sourceMappingURL=api.js.map