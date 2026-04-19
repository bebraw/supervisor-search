const SEARCH_ALIASES = new Map<string, string[]>([
  ["ai", ["artificial intelligence"]],
  ["ar", ["augmented reality"]],
  ["cv", ["computer vision"]],
  ["dl", ["deep learning"]],
  ["hci", ["human computer interaction"]],
  ["iot", ["internet of things"]],
  ["llm", ["large language model", "large language models"]],
  ["ml", ["machine learning"]],
  ["nlp", ["natural language processing"]],
  ["ux", ["user experience"]],
  ["vr", ["virtual reality"]],
  ["xr", ["extended reality"]],
]);

export function expandSearchAliases(query: string): string {
  const compactQuery = query.trim();
  if (!compactQuery) {
    return compactQuery;
  }

  const normalizedTokens = compactQuery
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);

  const expansions: string[] = [];

  for (const token of normalizedTokens) {
    for (const expansion of SEARCH_ALIASES.get(token) ?? []) {
      if (!expansions.includes(expansion)) {
        expansions.push(expansion);
      }
    }
  }

  return expansions.length === 0 ? compactQuery : `${compactQuery} ${expansions.join(" ")}`;
}
