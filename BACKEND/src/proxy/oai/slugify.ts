// Shared by the extractor so author/keyword IDs slug identically —
// the graph dedups on these, so a consistent algorithm is correctness, not style.
export const slugify = (text: string) =>
  text.toLowerCase().trim().replace(/[^a-z0-9]/g, "_").substring(0, 254);
