import { XMLParser } from "fast-xml-parser";

/**
 * Structural validation before the download is served -- catches a
 * malformed manifest or a missing asset reference rather than handing the
 * author a zip that fails on import. Not a substitute for the real ADL
 * SCORM Test Suite (the spec's acceptance criteria call that out as a
 * separate, stronger check), but it verifies the same things a broken
 * package would fail on: well-formed XML, the required SCORM 1.2
 * elements, and that every file the manifest references actually exists
 * in the package.
 */
export function validateManifest(
  manifestXml: string,
  packagedFileNames: Set<string>
): string[] {
  const errors: string[] = [];
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

  let parsed: unknown;
  try {
    parsed = parser.parse(manifestXml);
  } catch (error) {
    errors.push(`imsmanifest.xml is not well-formed XML: ${String(error)}`);
    return errors;
  }

  const manifest = (parsed as Record<string, unknown>)?.manifest as
    | Record<string, unknown>
    | undefined;
  if (!manifest) {
    errors.push("imsmanifest.xml has no root <manifest> element.");
    return errors;
  }

  const metadata = manifest.metadata as Record<string, unknown> | undefined;
  if (!metadata || metadata.schema !== "ADL SCORM" || String(metadata.schemaversion) !== "1.2") {
    errors.push("imsmanifest.xml is missing a valid SCORM 1.2 <metadata> block.");
  }

  const organizations = manifest.organizations as Record<string, unknown> | undefined;
  const organization = organizations?.organization as Record<string, unknown> | undefined;
  if (!organization || !organization.item) {
    errors.push("imsmanifest.xml is missing <organizations>/<organization>/<item>.");
  }

  const resources = manifest.resources as Record<string, unknown> | undefined;
  const resource = resources?.resource as Record<string, unknown> | undefined;
  if (!resource) {
    errors.push("imsmanifest.xml is missing a <resource>.");
  } else {
    if (resource["@_adlcp:scormtype"] !== "sco") {
      errors.push('<resource> must have adlcp:scormtype="sco".');
    }
    if (!resource["@_href"]) {
      errors.push("<resource> is missing its href (entry point).");
    } else if (!packagedFileNames.has(String(resource["@_href"]))) {
      errors.push(`<resource> href "${resource["@_href"]}" is not a file in the package.`);
    }

    const files = resource.file;
    const fileList = Array.isArray(files) ? files : files ? [files] : [];
    for (const file of fileList as Record<string, unknown>[]) {
      const href = file["@_href"] as string | undefined;
      if (!href) {
        errors.push("<file> element is missing its href.");
      } else if (!packagedFileNames.has(href)) {
        errors.push(`Manifest references "${href}" but it is not in the package.`);
      }
    }
  }

  const requiredRuntimeFiles = ["index.html", "styles.css", "scorm-api.js", "suspend-data.js", "player.js"];
  for (const required of requiredRuntimeFiles) {
    if (!packagedFileNames.has(required)) {
      errors.push(`Package is missing required runtime file "${required}".`);
    }
  }

  return errors;
}
