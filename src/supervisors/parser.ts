import type { SupervisorRecord } from "./types";

interface SupervisorDraftInput {
  name: string;
  topicArea: string;
  activeThesisCount: number;
  rawSource: string;
  importedAt: string;
}

interface CandidateDraft {
  name: string;
  topicArea: string;
  activeThesisCount: number;
  rawSource: string;
}

const candidateBlockPatterns = [
  /<tr\b[\s\S]*?<\/tr>/gi,
  /<article\b[\s\S]*?<\/article>/gi,
  /<li\b[\s\S]*?<\/li>/gi,
  /<section\b[\s\S]*?<\/section>/gi,
  /<div\b[^>]*data-supervisor[^>]*>[\s\S]*?<\/div>/gi,
];

export function parseSupervisorsHtml(html: string, importedAt = new Date().toISOString()): SupervisorRecord[] {
  const blocks = collectCandidateBlocks(html);
  const records: SupervisorRecord[] = [];
  const seenIds = new Set<string>();

  for (const block of blocks) {
    const draft = parseCandidateBlock(block);

    if (!draft) {
      continue;
    }

    const record = buildSupervisorRecord({
      ...draft,
      importedAt,
    });

    if (seenIds.has(record.supervisorId)) {
      continue;
    }

    seenIds.add(record.supervisorId);
    records.push(record);
  }

  return records;
}

export function buildSupervisorRecord(input: SupervisorDraftInput): SupervisorRecord {
  const name = normalizeWhitespace(input.name);
  const topicArea = normalizeWhitespace(input.topicArea);
  const activeThesisCount = Math.max(0, Math.trunc(input.activeThesisCount));
  const supervisorId = slugify(`${name}-${topicArea}`);

  return {
    supervisorId,
    name,
    topicArea,
    activeThesisCount,
    searchText: createSearchText(name, topicArea, activeThesisCount),
    sourceFingerprint: hashText(input.rawSource),
    importedAt: input.importedAt,
  };
}

export function createSearchText(name: string, topicArea: string, activeThesisCount: number): string {
  const thesisNoun = activeThesisCount === 1 ? "thesis" : "theses";
  return `${normalizeWhitespace(name)}. Topic area: ${normalizeWhitespace(topicArea)}. Currently supervising ${activeThesisCount} active MSc ${thesisNoun}.`;
}

export function normalizeWhitespace(value: string): string {
  return decodeHtmlEntities(value).replace(/\s+/g, " ").trim();
}

export function tokenizeSearchText(value: string): string[] {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/gi, " ");
  return normalized.split(/\s+/).filter((token) => token.length > 1);
}

function collectCandidateBlocks(html: string): string[] {
  const matches: string[] = [];

  for (const pattern of candidateBlockPatterns) {
    const found = html.match(pattern) ?? [];
    matches.push(...found);

    if (matches.length > 0) {
      break;
    }
  }

  if (matches.length === 0) {
    const plain = htmlToText(html);
    if (!plain) {
      return [];
    }
    return [html];
  }

  return matches;
}

function parseCandidateBlock(block: string): CandidateDraft | null {
  const cellTexts = extractTaggedTexts(block, "td");
  const headerTexts = extractTaggedTexts(block, "th");
  const structuredCells = cellTexts.length > 0 ? cellTexts : headerTexts;

  if (structuredCells.length >= 3) {
    const name = findNameFromCells(structuredCells);
    const count = findCountFromValues(structuredCells);
    const topicArea = findTopicFromCells(structuredCells, name);

    if (name && topicArea && count !== null) {
      return {
        name,
        topicArea,
        activeThesisCount: count,
        rawSource: htmlToText(block),
      };
    }
  }

  const plainText = htmlToText(block);
  const name = findNameFromMarkup(block) ?? findNameFromPlainText(plainText);
  const topicArea = findTopicArea(plainText);
  const activeThesisCount = findActiveThesisCount(plainText);

  if (!name || !topicArea || activeThesisCount === null) {
    return null;
  }

  return {
    name,
    topicArea,
    activeThesisCount,
    rawSource: plainText,
  };
}

function extractTaggedTexts(block: string, tagName: string): string[] {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "gi");
  return Array.from(block.matchAll(pattern))
    .map((match) => htmlToText(match[1] ?? ""))
    .filter(Boolean);
}

function findNameFromCells(values: string[]): string | null {
  return values.find((value) => !/^\d+$/.test(value) && value.split(/\s+/).length >= 2) ?? null;
}

function findTopicFromCells(values: string[], name: string | null): string | null {
  const candidates = values.filter((value) => value !== name && !/^\d+$/.test(value));
  if (candidates.length === 0) {
    return null;
  }

  return candidates.reduce((longest, current) => (current.length > longest.length ? current : longest));
}

function findCountFromValues(values: string[]): number | null {
  const exactMatch = values.find((value) => /^\d+$/.test(value.trim()));
  if (exactMatch) {
    return Number(exactMatch);
  }

  for (const value of values) {
    const match = value.match(/\b\d+\b/);
    if (match) {
      return Number(match[0]);
    }
  }

  return null;
}

function findNameFromMarkup(block: string): string | null {
  const pattern = /<(?:a|strong|b|h1|h2|h3|h4|h5|h6)\b[^>]*>([\s\S]*?)<\/(?:a|strong|b|h1|h2|h3|h4|h5|h6)>/gi;

  for (const match of block.matchAll(pattern)) {
    const text = htmlToText(match[1] ?? "");
    if (text.split(/\s+/).length >= 2) {
      return text;
    }
  }

  return null;
}

function findNameFromPlainText(plainText: string): string | null {
  const firstSentence = plainText.split(/[|\n]/)[0]?.trim() ?? "";
  return firstSentence.split(/\s+/).length >= 2 ? firstSentence : null;
}

function findTopicArea(plainText: string): string | null {
  const labeledMatch = plainText.match(
    /(?:topic area|topic|research area|area)\s*[:\-]\s*(.+?)(?=(?:current|active|thes(?:is|es)|advised currently|$))/i,
  );
  if (labeledMatch?.[1]) {
    return normalizeWhitespace(labeledMatch[1]);
  }

  const sentences = plainText
    .split(/[|]/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);

  const candidate = sentences.find((part) => !/\b\d+\b/.test(part) && part.split(/\s+/).length >= 3 && !/supervis/i.test(part));
  return candidate ?? null;
}

function findActiveThesisCount(plainText: string): number | null {
  const labeledMatch = plainText.match(
    /(?:active theses|active thesis|current theses|current thesis|theses advised currently|thesis count|supervising)\D{0,12}(\d{1,3})/i,
  );

  if (labeledMatch?.[1]) {
    return Number(labeledMatch[1]);
  }

  const fallbackMatch = plainText.match(/\b(\d{1,3})\b/);
  return fallbackMatch?.[1] ? Number(fallbackMatch[1]) : null;
}

function htmlToText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|section|article|li|tr|td|th|h1|h2|h3|h4|h5|h6)>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || `supervisor-${hashText(value).slice(0, 8)}`;
}

function hashText(value: string): string {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}
