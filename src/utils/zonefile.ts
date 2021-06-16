import { c32ToB58 } from "c32check"
import { extractTokenFileUrl } from "./signedToken"
import { decodeFQN, encodeFQN, normalizeAddress } from "./general"
import "isomorphic-fetch"
import { Some, None, Maybe, Right, Left, Either } from "monet"
import { identity } from "ramda"
const { parseZoneFile } = require("zone-file")
const b58 = require("bs58")

export const getZonefileRecordsForName =
  ({
    name,
    namespace,
    subdomain,
    owner,
  }: {
    name: string
    namespace: string
    subdomain?: string
    owner?: string
  }) =>
  (zonefile: string): Either<Error, string> => {
    const parsedZoneFile = parseZoneFile(zonefile)
    const origin = decodeFQN(parsedZoneFile["$origin"])

    if (origin.name === name && origin.namespace === namespace) {
      // We are in the wrong zonefile somehow :(
      if (origin.subdomain && origin.subdomain !== subdomain) {
        return Left(
          new Error(
            `Wrong zonefile, zf origin - ${origin}, looking for ${encodeFQN({
              name,
              namespace,
              subdomain,
            })}`
          )
        )
      }

      if (!origin.subdomain && subdomain) {
        if (!owner) {
          return Left(
            new Error(`No owner passed. Can not find nested zonefile.`)
          )
        }
      }

      if (origin.subdomain && origin.subdomain === subdomain) {
        return Right(zonefile)
      }

      if (parsedZoneFile.txt && owner) {
        return Right(
          findNestedZoneFileByOwner(zonefile, owner).cata(
            () => zonefile,
            (nestedZf) => nestedZf
          )
        )
      }

      if (!origin.subdomain && !subdomain) {
        return Right(zonefile)
      }

      return Left(new Error("zonefile not found"))
    }

    return Left(new Error("Zonefile $ORIGIN did not match passed name"))
  }

const parseZoneFileTXT = (entries: string[]) =>
  entries.reduce(
    (parsed, current) => {
      const [prop, value] = current.split("=")

      if (prop.startsWith("zf")) {
        return { ...parsed, zonefile: `${parsed.zonefile}${value}` }
      }

      return { ...parsed, [prop]: value }
    },
    { zonefile: "", owner: "" }
  )

const findNestedZoneFileByOwner = (
  zonefile: string,
  owner: string
): Maybe<string> => {
  const parsedZoneFile = parseZoneFile(zonefile)

  if (parsedZoneFile.txt) {
    const match = parsedZoneFile.txt.find(
      ({ txt }: { txt: string[]; name: string }) => {
        return parseZoneFileTXT(txt).owner === normalizeAddress(owner)
      }
    )

    if (match) {
      return Some(
        Buffer.from(parseZoneFileTXT(match.txt).zonefile, "base64").toString(
          "ascii"
        )
      )
    }
  }

  return None()
}

export const parseZoneFileAndExtractNameinfo =
  (owner: string) => (zonefile: string) => {
    const parsedZf = parseZoneFile(zonefile)

    const { name, namespace, subdomain } = decodeFQN(parsedZf["$origin"])

    return extractTokenFileUrl(zonefile).map((url) => ({
      name,
      namespace,
      subdomain,
      owner,
      tokenUrl: url,
    }))
  }

export const parseZoneFileAndExtractTokenUrl = (
  zonefile: string,
  owner: string
): Either<Error, string> => {
  const parsedZf = parseZoneFile(zonefile)

  const { name, namespace, subdomain } = decodeFQN(parsedZf["$origin"])

  return getZonefileRecordsForName({
    name,
    namespace,
    owner,
    subdomain,
  })(zonefile).flatMap(extractTokenFileUrl)
}
