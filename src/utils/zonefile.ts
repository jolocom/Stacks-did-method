import { extractTokenFileUrl, fetchAndVerifySignedToken } from "./signedToken"
import {
  decodeFQN,
  eitherToFuture,
  encodeFQN,
  normalizeAddress,
} from "./general"
import "isomorphic-fetch"
import { Right, Left, Either } from "monet"
import { chain } from "fluture"
const { parseZoneFile } = require("zone-file")
const b58 = require("bs58")

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
  const origin = decodeFQN(parsedZoneFile["$origin"])
  if (
    origin.name !== name ||
    origin.namespace !== namespace ||
    origin.subdomain !== subdomain
  ) {
    return Left(
      new Error(
        `Wrong zonefile, zf origin - ${JSON.stringify(
          origin
        )}, looking for ${encodeFQN({
          name,
          namespace,
          subdomain,
        })}`
      )
    )
  }

  return Right(zonefile)
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

  return Left(new Error(`No zonefile for subdomain ${subdomain} found`))
}

export const findSubdomainZonefile = (
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

  return Left(new Error(`No zonefile for subdomain owned by ${owner} found`))
}

export const parseZoneFileAndExtractNameinfo = (zonefile: string) => {
  const parsedZf = parseZoneFile(zonefile)

  const { name, namespace, subdomain } = decodeFQN(parsedZf["$origin"])

  return extractTokenFileUrl(zonefile).map((url) => ({
    name,
    namespace,
    subdomain,
    tokenUrl: url,
  }))
}

export const parseZoneFileAndExtractTokenUrl = (
  zonefile: string
): Either<Error, string> => {
  const parsedZf = parseZoneFile(zonefile)

  const { name, namespace, subdomain } = decodeFQN(parsedZf["$origin"])

  return ensureZonefileMatchesName({
    zonefile,
    name,
    namespace,
    subdomain,
  }).flatMap(extractTokenFileUrl)
}

export const getPublicKeyUsingZoneFile = (zf: string, ownerAddress: string) =>
  eitherToFuture(parseZoneFileAndExtractNameinfo(zf)).pipe(
    chain(({ tokenUrl }) => fetchAndVerifySignedToken(tokenUrl, normalizeAddress(ownerAddress)))
  )
