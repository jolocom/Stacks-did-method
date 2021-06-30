import { StacksNetwork } from "@stacks/network";
export declare const findValidNames: (network: StacksNetwork, onlyMigrated?: boolean) => (page?: number) => import("fluture").FutureInstance<Error, import("fluture").FutureInstance<Error | import("monet").Maybe<unknown>, unknown>[]>;
export declare const debug: (prefix: string) => <T>(arg: T) => T;
