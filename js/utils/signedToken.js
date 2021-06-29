"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyTokenAndGetPubKey = exports.extractTokenFileUrl = void 0;
const profile_1 = require("@stacks/profile");
const monet_1 = require("monet");
const profile_2 = require("@stacks/profile");
const { parseZoneFile } = require("zone-file");
// import { parseZoneFile } from "zone-file"
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
//# sourceMappingURL=signedToken.js.map