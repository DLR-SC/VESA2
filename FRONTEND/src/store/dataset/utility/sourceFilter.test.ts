import { describe, it, expect } from "vitest";
import { applySourceFilter } from "./utility";
import type { IDataset, IKeywordData, AuthorData } from "types/appData";

const ds = (id: string, prefix: string): IDataset =>
  ({ id, dataset_source_prefix: prefix } as unknown as IDataset);

const datasets = [ds("Dataset/1", "pangaea"), ds("Dataset/2", "gbif")];
const keywords: IKeywordData[] = [
  { keyword: "ocean", count: 2, dataset_id: ["Dataset/1", "Dataset/2"] as any },
];
const authors: AuthorData[] = [
  { author: "A", datasets: ["Dataset/1", "Dataset/2"] as any },
  { author: "B", datasets: ["Dataset/2"] as any },
];

describe("applySourceFilter", () => {
  it("returns input untouched when nothing is disconnected", () => {
    const out = applySourceFilter({ datasets, keywords, authors }, []);
    expect(out.datasets).toBe(datasets);
    expect(out.keywords).toBe(keywords);
  });

  it("hides a disconnected source across datasets, keywords and authors", () => {
    const out = applySourceFilter({ datasets, keywords, authors }, ["gbif"]);
    // dataset gone
    expect(out.datasets.map((d) => d.id)).toEqual(["Dataset/1"]);
    // keyword pruned to surviving ids + recounted
    expect(out.keywords[0].dataset_id).toEqual(["Dataset/1"]);
    expect(out.keywords[0].count).toBe(1);
    // author B (only in gbif) dropped, author A pruned to surviving ids
    expect(out.authors.map((a) => a.author)).toEqual(["A"]);
    expect(out.authors[0].datasets).toEqual(["Dataset/1"]);
  });
});
