"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicKeyUsingZoneFile = exports.parseZoneFileAndExtractNameinfo = exports.findSubdomainZonefile = exports.findSubdomainZoneFileByName = exports.parseZoneFileTXT = exports.ensureZonefileMatchesName = void 0;
const signedToken_1 = require("./signedToken");
const general_1 = require("./general");
require("isomorphic-fetch");
const monet_1 = require("monet");
const fluture_1 = require("fluture");
const { parseZoneFile } = require("zone-file");
const b58 = require("bs58");
const ensureZonefileMatchesName = ({ zonefile, name, namespace, subdomain, }) => {
    const parsedZoneFile = parseZoneFile(zonefile);
    const origin = general_1.decodeFQN(parsedZoneFile["$origin"]);
    if (origin.name !== name ||
        origin.namespace !== namespace ||
        origin.subdomain !== subdomain) {
        return monet_1.Left(new Error(`Wrong zonefile, zf origin - ${JSON.stringify(origin)}, looking for ${general_1.encodeFQN({
            name,
            namespace,
            subdomain,
        })}`));
    }
    return monet_1.Right(zonefile);
};
exports.ensureZonefileMatchesName = ensureZonefileMatchesName;
const parseZoneFileTXT = (entries) => entries.reduce((parsed, current) => {
    const [prop, value] = current.split("=");
    if (prop.startsWith("zf")) {
        return Object.assign(Object.assign({}, parsed), { zonefile: `${parsed.zonefile}${value}` });
    }
    return Object.assign(Object.assign({}, parsed), { [prop]: value });
}, { zonefile: "", owner: "", seqn: "0" });
exports.parseZoneFileTXT = parseZoneFileTXT;
const findSubdomainZoneFileByName = (nameZonefile, subdomain) => {
    const parsedZoneFile = parseZoneFile(nameZonefile);
    if (parsedZoneFile.txt) {
        const match = parsedZoneFile.txt.find((arg) => {
            return arg.name === subdomain;
        });
        if (match) {
            const { owner, zonefile } = exports.parseZoneFileTXT(match.txt);
            return monet_1.Right({
                subdomain: match.name,
                owner,
                zonefile: Buffer.from(zonefile, "base64").toString("ascii"),
            });
        }
    }
    return monet_1.Left(new Error(`No zonefile for subdomain ${subdomain} found`));
};
exports.findSubdomainZoneFileByName = findSubdomainZoneFileByName;
const findSubdomainZonefile = (nameZonefile, owner) => {
    const parsedZoneFile = parseZoneFile(nameZonefile);
    if (parsedZoneFile.txt) {
        const match = parsedZoneFile.txt.find((arg) => {
            return exports.parseZoneFileTXT(arg.txt).owner === general_1.normalizeAddress(owner);
        });
        if (match) {
            return monet_1.Right({
                subdomain: match.name,
                zonefile: Buffer.from(exports.parseZoneFileTXT(match.txt).zonefile, "base64").toString("ascii"),
            });
        }
    }
    return monet_1.Left(new Error(`No zonefile for subdomain owned by ${owner} found`));
};
exports.findSubdomainZonefile = findSubdomainZonefile;
const parseZoneFileAndExtractNameinfo = (zonefile) => {
    const parsedZf = parseZoneFile(zonefile);
    const { name, namespace, subdomain } = general_1.decodeFQN(parsedZf["$origin"]);
    return signedToken_1.extractTokenFileUrl(zonefile).map((url) => ({
        name,
        namespace,
        subdomain,
        tokenUrl: url,
    }));
};
exports.parseZoneFileAndExtractNameinfo = parseZoneFileAndExtractNameinfo;
const getPublicKeyUsingZoneFile = (zf, ownerAddress) => general_1.eitherToFuture(exports.parseZoneFileAndExtractNameinfo(zf)).pipe(fluture_1.chain(({ tokenUrl }) => signedToken_1.fetchAndVerifySignedToken(tokenUrl, general_1.normalizeAddress(ownerAddress))));
exports.getPublicKeyUsingZoneFile = getPublicKeyUsingZoneFile;
//# sourceMappingURL=zonefile.js.map