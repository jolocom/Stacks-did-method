"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchAndVerifySignedToken = exports.verifyTokenAndGetPubKey = exports.extractTokenFileUrl = void 0;
const profile_1 = require("@stacks/profile");
const monet_1 = require("monet");
const profile_2 = require("@stacks/profile");
const api_1 = require("../api");
const general_1 = require("./general");
const fluture_1 = require("fluture");
const { parseZoneFile } = require("zone-file");
const extractTokenFileUrl = (zoneFile) => {
    try {
        const url = profile_1.getTokenFileUrl(parseZoneFile(zoneFile));
        return url
            ? monet_1.Right(url)
            : monet_1.Left(new Error("No url for signed token found in zonefile"));
    }
    catch (e) {
        return monet_1.Left(e);
    }
};
exports.extractTokenFileUrl = extractTokenFileUrl;
const verifyTokenAndGetPubKey = (owner) => ({ token }) => {
    try {
        const { payload } = profile_2.verifyProfileToken(token, owner);
        //@ts-ignore
        return monet_1.Right(payload.subject.publicKey);
    }
    catch (e) {
        return monet_1.Left(e);
    }
};
exports.verifyTokenAndGetPubKey = verifyTokenAndGetPubKey;
const fetchAndVerifySignedToken = (tokenUrl, ownerAddress) => api_1.fetchSignedToken(tokenUrl)
    .pipe(fluture_1.map(exports.verifyTokenAndGetPubKey(general_1.normalizeAddress(ownerAddress))))
    .pipe(fluture_1.chain(general_1.eitherToFuture));
exports.fetchAndVerifySignedToken = fetchAndVerifySignedToken;
//# sourceMappingURL=signedToken.js.map