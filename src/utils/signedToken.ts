import { getTokenFileUrl } from "@stacks/profile"
import { Right, Left, Either } from "monet"
import { verifyProfileToken } from "@stacks/profile"
import { fetchSignedToken } from "../api"
import { eitherToFuture, normalizeAddress } from "./general"
import { chain, map } from "fluture"
const { parseZoneFile } = require("zone-file")

export const extractTokenFileUrl = (
  zoneFile: string
): Either<Error, string> => {
  try {
    const url = getTokenFileUrl(parseZoneFile(zoneFile))
    return url
      ? Right(url)
      : Left(new Error("No url for signed token found in zonefile"))
  } catch (e) {
    return Left(e)
  }
}

export const verifyTokenAndGetPubKey =
  (owner: string) =>
  ({ token }: { token: string }): Either<Error, string> => {
    try {
      const { payload } = verifyProfileToken(token, owner)
      //@ts-ignore
      return Right(payload.subject.publicKey)
    } catch (e) {
      return Left(e)
    }
  }

export const fetchAndVerifySignedToken = (
  tokenUrl: string,
  ownerAddress: string
) =>
  fetchSignedToken(tokenUrl)
    .pipe(map(verifyTokenAndGetPubKey(normalizeAddress(ownerAddress))))
    .pipe(chain(eitherToFuture))
