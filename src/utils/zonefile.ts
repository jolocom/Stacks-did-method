import { getTokenFileUrl } from "@stacks/profile"
import { fetchAndVerifySignedToken } from "./signedToken"
import { decodeFQN, eitherToFuture, normalizeAddress } from "./general"
import "isomorphic-fetch"
import { Right, Left, Either } from "monet"
import { chain } from "fluture"
import { DIDResolutionError, DIDResolutionErrorCodes } from "../errors"
const { parseZoneFile } = require("zone-file")

export const ensureZonefileMatchesName = ({
  zonefile,
  name,
  namespace,
  subdomain,
}: {
  zonefile: string
  name: string
  namespace: string
  subdomain?: string
}): Either<Error, string> => {
  const parsedZoneFile = parseZoneFile(zonefile)

  return decodeFQN(parsedZoneFile["$origin"]).flatMap((origin) => {
    if (
      origin.name !== name ||
      origin.namespace !== namespace ||
      origin.subdomain !== subdomain
    ) {
      return Left(
        new DIDResolutionError(
          DIDResolutionErrorCodes.InvalidZonefile,
          "Zone file $ORIGIN does not match expected BNS name"
        )
      )
    }

    return Right(zonefile)
  })
}

export const parseZoneFileTXT = (entries: string[]) =>
  entries.reduce(
    (parsed, current) => {
      const [prop, value] = current.split("=")

      if (prop.startsWith("zf")) {
        return { ...parsed, zonefile: `${parsed.zonefile}${value}` }
      }

      return { ...parsed, [prop]: value }
    },
    { zonefile: "", owner: "", seqn: "0" }
  )

export const findSubdomainZoneFileByName = (
  nameZonefile: string,
  subdomain: string
): Either<
  Error,
  { zonefile: string; subdomain: string | undefined; owner: string }
> => {
  const parsedZoneFile = parseZoneFile(nameZonefile)

  if (parsedZoneFile.txt) {
    const match = parsedZoneFile.txt.find((arg: { name: string }) => {
      return arg.name === subdomain
    })

    if (match) {
      const { owner, zonefile } = parseZoneFileTXT(match.txt)
      return Right({
        subdomain: match.name,
        owner,
        zonefile: Buffer.from(zonefile, "base64").toString("ascii"),
      })
    }
  }

  return Left(
    new DIDResolutionError(
      DIDResolutionErrorCodes.MissingZoneFile,
      "No zone file found for subdomain"
    )
  )
}

export const findSubdomainZonefileByOwner = (
  nameZonefile: string,
  owner: string
): Either<
  Error,
  {
    zonefile: string
    subdomain: string
  }
> => {
  const parsedZoneFile = parseZoneFile(nameZonefile)

  if (parsedZoneFile.txt) {
    const match = parsedZoneFile.txt.find((arg: { txt: string[] }) => {
      return parseZoneFileTXT(arg.txt).owner === normalizeAddress(owner)
    })

    if (match) {
      return Right({
        subdomain: match.name,
        zonefile: Buffer.from(
          parseZoneFileTXT(match.txt).zonefile,
          "base64"
        ).toString("ascii"),
      })
    }
  }

  return Left(
    new DIDResolutionError(
      DIDResolutionErrorCodes.MissingZoneFile,
      "No zone file found for subdomain"
    )
  )
}

export const parseZoneFileAndExtractNameinfo = (zonefile: string) => {
  const parsedZf = parseZoneFile(zonefile)

  return decodeFQN(parsedZf["$origin"]).flatMap(
    ({ name, namespace, subdomain }) =>
      extractTokenFileUrl(zonefile).map((url) => ({
        name,
        namespace,
        subdomain,
        tokenUrl: url,
      }))
  )
}

export const getPublicKeyUsingZoneFile = (zf: string, ownerAddress: string) =>
  eitherToFuture(parseZoneFileAndExtractNameinfo(zf)).pipe(
    chain(({ tokenUrl }) =>
      fetchAndVerifySignedToken(tokenUrl, normalizeAddress(ownerAddress))
    )
  )

const extractTokenFileUrl = (zoneFile: string): Either<Error, string> => {
  try {
    const url = getTokenFileUrl(parseZoneFile(zoneFile))
    return url
      ? Right(url)
      : Left(
          new DIDResolutionError(
            DIDResolutionErrorCodes.InvalidZonefile,
            "Missing URI resource record in zone file"
          )
        )
  } catch (e) {
    return Left(e)
  }
}
