import "isomorphic-fetch";
import { Either } from "monet";
export declare const ensureZonefileMatchesName: ({ zonefile, name, namespace, subdomain, }: {
    zonefile: string;
    name: string;
    namespace: string;
    subdomain?: string | undefined;
}) => Either<Error, string>;
export declare const parseZoneFileTXT: (entries: string[]) => {
    zonefile: string;
    owner: string;
    seqn: string;
};
export declare const findSubdomainZoneFileByName: (nameZonefile: string, subdomain: string) => Either<Error, {
    zonefile: string;
    subdomain: string | undefined;
    owner: string;
}>;
export declare const findSubdomainZonefile: (nameZonefile: string, owner: string) => Either<Error, {
    zonefile: string;
    subdomain: string;
}>;
export declare const parseZoneFileAndExtractNameinfo: (zonefile: string) => Either<Error, {
    name: string;
    namespace: string;
    subdomain: string | undefined;
    tokenUrl: string;
}>;
export declare const getPublicKeyUsingZoneFile: (zf: string, ownerAddress: string) => import("fluture").FutureInstance<Error, string>;
