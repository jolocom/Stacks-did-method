import { Right, Left, Either } from "monet"
import { verifyProfileToken } from "@stacks/profile"
import { fetchSignedToken } from "../api"
import { eitherToFuture, normalizeAddress } from "./general"
import { chain, map } from "fluture"
import { DIDResolutionError, DIDResolutionErrorCodes } from "../errors"

export const fetchAndVerifySignedToken = (
  tokenUrl: string,
  ownerAddress: string
) =>
  fetchSignedToken(tokenUrl)
    .pipe(map(verifyTokenAndGetPubKey(normalizeAddress(ownerAddress))))
    .pipe(chain(eitherToFuture))

const verifyTokenAndGetPubKey =
  (owner: string) =>
  ({ token }: { token: string }): Either<Error, string> => {
    try {
      const { payload } = verifyProfileToken(token, owner)
      //@ts-ignore
      return Right(payload.subject.publicKey)
    } catch (e) {
      return Left(
        new DIDResolutionError(
          DIDResolutionErrorCodes.InvalidSignedProfileToken,
          e.message
        )
      )
    }
  }
