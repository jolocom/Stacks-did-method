"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseZoneFileAndExtractTokenUrl = exports.parseZoneFileAndExtractNameinfo = exports.getZonefileRecordsForName = void 0;
const signedToken_1 = require("./signedToken");
const general_1 = require("./general");
require("isomorphic-fetch");
const monet_1 = require("monet");
const { parseZoneFile } = require("zone-file");
const b58 = require("bs58");
const getZonefileRecordsForName = ({ name, namespace, subdomain, owner, }) => (zonefile) => {
    const parsedZoneFile = parseZoneFile(zonefile);
    const origin = general_1.decodeFQN(parsedZoneFile["$origin"]);
    if (origin.name === name && origin.namespace === namespace) {
        // We are in the wrong zonefile somehow :(
        if (origin.subdomain && origin.subdomain !== subdomain) {
            return monet_1.Left(new Error(`Wrong zonefile, zf origin - ${origin}, looking for ${general_1.encodeFQN({
                name,
                namespace,
                subdomain,
            })}`));
        }
        if (!origin.subdomain && subdomain) {
            if (!owner) {
                return monet_1.Left(new Error(`No owner passed. Can not find nested zonefile.`));
            }
        }
        if (origin.subdomain && origin.subdomain === subdomain) {
            return monet_1.Right(zonefile);
        }
        if (parsedZoneFile.txt && owner) {
            return monet_1.Right(findNestedZoneFileByOwner(zonefile, owner).cata(() => zonefile, (nestedZf) => nestedZf));
        }
        if (!origin.subdomain && !subdomain) {
            return monet_1.Right(zonefile);
        }
        return monet_1.Left(new Error("zonefile not found"));
    }
    return monet_1.Left(new Error("Zonefile $ORIGIN did not match passed name"));
};
exports.getZonefileRecordsForName = getZonefileRecordsForName;
const parseZoneFileTXT = (entries) => entries.reduce((parsed, current) => {
    const [prop, value] = current.split("=");
    if (prop.startsWith("zf")) {
        return Object.assign(Object.assign({}, parsed), { zonefile: `${parsed.zonefile}${value}` });
    }
    return Object.assign(Object.assign({}, parsed), { [prop]: value });
}, { zonefile: "", owner: "" });
const findNestedZoneFileByOwner = (zonefile, owner) => {
    const parsedZoneFile = parseZoneFile(zonefile);
    if (parsedZoneFile.txt) {
        const match = parsedZoneFile.txt.find(({ txt }) => {
            return parseZoneFileTXT(txt).owner === general_1.normalizeAddress(owner);
        });
        if (match) {
            return monet_1.Some(Buffer.from(parseZoneFileTXT(match.txt).zonefile, "base64").toString("ascii"));
        }
    }
    return monet_1.None();
};
const parseZoneFileAndExtractNameinfo = (owner) => (zonefile) => {
    const parsedZf = parseZoneFile(zonefile);
    const { name, namespace, subdomain } = general_1.decodeFQN(parsedZf["$origin"]);
    return signedToken_1.extractTokenFileUrl(zonefile).map((url) => ({
        name,
        namespace,
        subdomain,
        owner,
        tokenUrl: url,
    }));
};
exports.parseZoneFileAndExtractNameinfo = parseZoneFileAndExtractNameinfo;
const parseZoneFileAndExtractTokenUrl = (zonefile, owner) => {
    const parsedZf = parseZoneFile(zonefile);
    const { name, namespace, subdomain } = general_1.decodeFQN(parsedZf["$origin"]);
    return exports.getZonefileRecordsForName({
        name,
        namespace,
        owner,
        subdomain,
    })(zonefile).flatMap(signedToken_1.extractTokenFileUrl);
};
exports.parseZoneFileAndExtractTokenUrl = parseZoneFileAndExtractTokenUrl;
//# sourceMappingURL=zonefile.js.map