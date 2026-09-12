function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * SCORM 1.2 imsmanifest.xml, single-SCO (the whole course as one resource
 * with its own in-package outline/menu) -- the default the spec calls out
 * as simplest and most reliable for Moodle import.
 */
export function generateManifest(courseId: string, title: string, fileNames: string[]): string {
  const orgId = `ETVET_ORG_${courseId}`;
  const itemId = `ETVET_ITEM_${courseId}`;
  const resourceId = `ETVET_RESOURCE_${courseId}`;
  const manifestId = `ETVET_COURSE_${courseId}`;

  const fileEntries = fileNames.map((name) => `      <file href="${xmlEscape(name)}"/>`).join("\n");

  return `<?xml version="1.0" standalone="no"?>
<manifest identifier="${xmlEscape(manifestId)}" version="1"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
                       http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="${xmlEscape(orgId)}">
    <organization identifier="${xmlEscape(orgId)}">
      <title>${xmlEscape(title)}</title>
      <item identifier="${xmlEscape(itemId)}" identifierref="${xmlEscape(resourceId)}">
        <title>${xmlEscape(title)}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="${xmlEscape(resourceId)}" type="webcontent" adlcp:scormtype="sco" href="index.html">
${fileEntries}
    </resource>
  </resources>
</manifest>
`;
}
