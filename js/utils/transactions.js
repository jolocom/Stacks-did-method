"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseAndValidateTransaction = void 0;
const ramda_1 = require("ramda");
const transactions_1 = require("@stacks/transactions");
const general_1 = require("./general");
const constants_1 = require("../constants");
const monet_1 = require("monet");
//TODO Find type for tx json
const parseAndValidateTransaction = (tx) => {
    const allowedFunctionNames = [
        "name-register",
        "name-import",
        "name-update",
        "name-renewal",
    ];
    if (tx.tx_status !== "success") {
        return monet_1.Left(new Error(`Invalid TX status for ${tx.tx_id}, expected success`));
    }
    const contractCallData = tx.contract_call;
    if (!contractCallData) {
        return monet_1.Left(new Error("resolve failed, no contract_call in fetched tx"));
    }
    if (!Object.values(constants_1.BNS_ADDRESSES).includes(contractCallData.contract_id)) {
        return monet_1.Left(new Error("Must reference TX to the BNS contract address, mainnet or testnet"));
    }
    const calledFunction = contractCallData["function_name"];
    if (!allowedFunctionNames.includes(calledFunction)) {
        return monet_1.Left(new Error(`call ${calledFunction} not allowed. supported methods are ${allowedFunctionNames.toString()}`));
    }
    return extractContractCallArgs(contractCallData.function_args);
};
exports.parseAndValidateTransaction = parseAndValidateTransaction;
/**
 * Extracts the namespace, name, and zonefile-hash arguments from a name-register / name-update TX
 * @returns nameInfo - the name, namespace, and zonefile-hash encoded in the TX
 */
const extractContractCallArgs = (functionArgs) => {
    const relevantArguments = ["name", "namespace", "zonefile-hash"];
    const { name, namespace, "zonefile-hash": zonefileHash, } = functionArgs.reduce((parsed, current) => {
        if (relevantArguments.includes(current.name)) {
            return Object.assign(Object.assign({}, parsed), { [current.name]: current.hex });
        }
        return parsed;
    }, {});
    if (!name || !namespace || !zonefileHash) {
        return monet_1.Left(new Error(`Not all arguments present, got ${JSON.stringify({
            name,
            namespace,
            zonefileHash,
        })}`));
    }
    const hexEncodedValues = [name, namespace, zonefileHash].map(ramda_1.compose(transactions_1.cvToValue, transactions_1.hexToCV, general_1.stripHexPrefixIfPresent));
    return monet_1.Right({
        name: general_1.hexToAscii(hexEncodedValues[0]),
        namespace: general_1.hexToAscii(hexEncodedValues[1]),
        zonefileHash: typeof hexEncodedValues[2] === "string"
            ? general_1.stripHexPrefixIfPresent(hexEncodedValues[2])
            : general_1.stripHexPrefixIfPresent(hexEncodedValues[2].value),
    });
};
//# sourceMappingURL=transactions.js.map