import { describe, expect, it } from "vitest";
import { generateManifest } from "./manifest";
import { validateManifest } from "./validate";

const REQUIRED_RUNTIME_FILES = ["index.html", "styles.css", "scorm-api.js", "suspend-data.js", "player.js"];

describe("generateManifest + validateManifest round trip", () => {
  it("produces a manifest that validates cleanly against its own package file list", () => {
    const fileNames = [...REQUIRED_RUNTIME_FILES, "lesson-1.json"];
    const xml = generateManifest("course-123", "My Course", fileNames);
    const errors = validateManifest(xml, new Set(fileNames));
    expect(errors).toEqual([]);
  });

  it("XML-escapes a title containing special characters without breaking validation", () => {
    const fileNames = [...REQUIRED_RUNTIME_FILES];
    const xml = generateManifest("course-1", `Sales 101 & "Onboarding" <2024>`, fileNames);
    expect(xml).toContain("Sales 101 &amp; &quot;Onboarding&quot; &lt;2024&gt;");
    expect(validateManifest(xml, new Set(fileNames))).toEqual([]);
  });
});

describe("validateManifest", () => {
  const fileNames = [...REQUIRED_RUNTIME_FILES];
  const validXml = generateManifest("course-1", "Course", fileNames);

  it("rejects unparseable XML", () => {
    const errors = validateManifest('<manifest attr="unterminated>', new Set(fileNames));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/not well-formed/);
  });

  it("rejects well-formed XML that has no <manifest> root", () => {
    const errors = validateManifest("<somethingElse/>", new Set(fileNames));
    expect(errors).toEqual(["imsmanifest.xml has no root <manifest> element."]);
  });

  it("flags a missing required runtime file", () => {
    const errors = validateManifest(validXml, new Set(["index.html"]));
    expect(errors.some((e) => e.includes('"styles.css"'))).toBe(true);
    expect(errors.some((e) => e.includes('"player.js"'))).toBe(true);
  });

  it("flags a <resource> href that isn't actually in the package", () => {
    const brokenXml = validXml.replace('href="index.html"', 'href="missing.html"');
    const errors = validateManifest(brokenXml, new Set(fileNames));
    expect(errors.some((e) => e.includes("missing.html"))).toBe(true);
  });

  it("flags a resource missing the adlcp:scormtype=\"sco\" attribute", () => {
    const brokenXml = validXml.replace('adlcp:scormtype="sco"', 'adlcp:scormtype="asset"');
    const errors = validateManifest(brokenXml, new Set(fileNames));
    expect(errors.some((e) => e.includes('scormtype="sco"'))).toBe(true);
  });
});
