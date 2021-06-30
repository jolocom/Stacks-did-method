import { Either } from "monet";
export declare const extractTokenFileUrl: (zoneFile: string) => Either<Error, string>;
export declare const verifyTokenAndGetPubKey: (owner: string) => ({ token }: {
    token: string;
}) => Either<Error, string>;
export declare const fetchAndVerifySignedToken: (tokenUrl: string, ownerAddress: string) => import("fluture").FutureInstance<Error, string>;
