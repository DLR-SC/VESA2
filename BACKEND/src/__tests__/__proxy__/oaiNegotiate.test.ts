import { negotiate } from "../../proxy/oai/router";
import { OaiPage } from "../../proxy/oai/transport";

// negotiate() probes formats richest-first and must fall through a schema that is
// listed but unusable — served empty (noRecordsMatch, e.g. Ariadne's oai_ead) or not
// served at all (cannotDisseminateFormat) — down to the oai_dc floor, while still
// surfacing genuine (network) errors. No network: fetchPage/getFormats are injected.

const page = (n: number): OaiPage => ({
  records: Array.from({ length: n }, (_, i) => ({ id: i })),
  nextToken: null,
});
const oaiErr = (code: string) => {
  const e: any = new Error(`OAI-PMH error (${code})`);
  e.oaiCode = code;
  return e;
};

describe("negotiate() schema fallthrough", () => {
  it("falls through a listed-but-empty schema (noRecordsMatch) to oai_dc", async () => {
    const getFormats = async () => ["oai_dc", "oai_ead"];
    const fetchPage = async (url: string) => {
      if (url.includes("oai_ead")) throw oaiErr("noRecordsMatch");
      return page(3);
    };
    const { prefix, page: p } = await negotiate("http://x?page_id=1", undefined, undefined, fetchPage, getFormats);
    expect(prefix).toBe("oai_dc");
    expect(p.records).toHaveLength(3);
  });

  it("also falls through cannotDisseminateFormat", async () => {
    const getFormats = async () => ["oai_datacite", "oai_dc"];
    const fetchPage = async (url: string) => {
      if (url.includes("oai_datacite")) throw oaiErr("cannotDisseminateFormat");
      return page(1);
    };
    const { prefix } = await negotiate("http://x", undefined, undefined, fetchPage, getFormats);
    expect(prefix).toBe("oai_dc");
  });

  it("rethrows a non-schema (network) error instead of masking it as a fallback", async () => {
    const getFormats = async () => ["oai_dc"];
    const fetchPage = async () => {
      throw new Error("ECONNRESET");
    };
    await expect(
      negotiate("http://x", undefined, undefined, fetchPage, getFormats)
    ).rejects.toThrow("ECONNRESET");
  });
});
