"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapDidToBNSName = void 0;
const fluture_1 = require("fluture");
const monet_1 = require("monet");
const api_1 = require("../api");
const general_1 = require("./general");
const transactions_1 = require("./transactions");
const zonefile_1 = require("./zonefile");
const mapDidToBNSName = (did, network) => getZonefileForDid(did, network)
    .pipe(fluture_1.map(zonefile_1.parseZoneFileAndExtractNameinfo))
    .pipe(fluture_1.chain(general_1.eitherToFuture));
exports.mapDidToBNSName = mapDidToBNSName;
const getZonefileForDid = (did, network) => api_1.fetchTransactionById(network.coreApiUrl)(did.anchorTxId)
    .pipe(fluture_1.map(transactions_1.parseAndValidateTransaction))
    .pipe(fluture_1.chain(general_1.eitherToFuture))
    .pipe(fluture_1.chain((_a) => {
    var { subdomainInception } = _a, nameInfo = __rest(_a, ["subdomainInception"]);
    return api_1.fetchZoneFileForName(network.coreApiUrl)(nameInfo)
        .pipe(fluture_1.map((zonefile) => subdomainInception
        ? zonefile_1.findSubdomainZonefile(zonefile, did.address)
        : monet_1.Right({
            zonefile,
            subdomain: undefined,
        })))
        .pipe(fluture_1.chain((relevantZf) => general_1.eitherToFuture(relevantZf.flatMap(({ subdomain, zonefile }) => zonefile_1.ensureZonefileMatchesName({
        name: nameInfo.name,
        namespace: nameInfo.namespace,
        subdomain,
        zonefile,
    })))));
}));
//# sourceMappingURL=bns.js.map