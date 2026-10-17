import { readFile, readdir } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { SOURCE_FILE_TYPES, type SourceFileType } from '@brd/shared';
import { chunkSections } from '../../jobs/chunker.js';
import { markdownSections } from '../../jobs/parsers/markdown.js';
import { parseFile, type ParsedSection } from '../../jobs/parsers/index.js';
import type { LlmService } from '../../services/llm/llm.service.js';
import { createFakeRepository, type FakeChunk } from './fake-repository.js';
import { createExtractionService } from './extraction.service.js';

/** Sample files the evaluation reads, besides the document types people can upload. */
const TEXT_EXTENSIONS = ['.md', '.markdown', '.txt'];

export interface SampleChunk {
  id: string;
  file: string;
  headingPath: string[];
  content: string;
}

export interface SampleRunSummary {
  chunks: number;
  flaggedForReview: number;
  modules: number;
  requirements: number;
  rules: number;
}

function uploadableType(fileName: string): SourceFileType | null {
  const lower = fileName.toLowerCase();
  const entry = Object.entries(SOURCE_FILE_TYPES).find(([, spec]) => lower.endsWith(spec.extension));
  return entry ? (entry[0] as SourceFileType) : null;
}

async function sectionsOf(fileName: string, bytes: Buffer): Promise<ParsedSection[]> {
  if (TEXT_EXTENSIONS.includes(extname(fileName).toLowerCase())) {
    return markdownSections(bytes.toString('utf8'), [basename(fileName, extname(fileName))]);
  }
  const type = uploadableType(fileName);
  return type ? parseFile(type, bytes) : [];
}

/** Reads every supported file in the folder and cuts it into chunks the way the pipeline does. */
export async function loadSamples(dir: string): Promise<SampleChunk[]> {
  const names = (await readdir(dir)).filter((name) => !name.startsWith('.')).sort();
  const chunks: SampleChunk[] = [];
  for (const file of names) {
    const sections = await sectionsOf(file, await readFile(join(dir, file)));
    for (const chunk of chunkSections(`sample:${file}`, sections)) {
      chunks.push({
        id: chunk.chunkKey,
        file,
        headingPath: chunk.headingPath,
        content: chunk.content,
      });
    }
  }
  return chunks;
}

const SAMPLE_SCOPE = { organizationId: 'sample-org', projectId: 'sample-project' };

/**
 * Runs the real extraction service over the chunks against an in-memory project and reports what came
 * out. Nothing is stored anywhere; no chunk text is printed or logged.
 */
export async function runSamples(
  chunks: SampleChunk[],
  llm: Pick<LlmService, 'run'>,
  onProgress: (done: number, total: number) => void = () => undefined,
): Promise<SampleRunSummary> {
  const fake = createFakeRepository({
    ...SAMPLE_SCOPE,
    chunks: chunks.map(
      (chunk): FakeChunk => ({
        id: chunk.id,
        sourceId: chunk.file,
        content: chunk.content,
        headingPath: chunk.headingPath,
        current: true,
        extractedAt: null,
        needsReview: false,
      }),
    ),
  });
  const service = createExtractionService({
    repo: fake.repo,
    llm,
    transaction: (fn) => fn({} as never),
    audit: async () => undefined,
  });

  let done = 0;
  for (const chunk of chunks) {
    await service.extractChunk({ ...SAMPLE_SCOPE, chunkId: chunk.id });
    done += 1;
    onProgress(done, chunks.length);
  }

  const items = [...fake.state.items.values()];
  const count = (kind: string) => items.filter((item) => item.kind === kind).length;
  return {
    chunks: chunks.length,
    flaggedForReview: [...fake.state.chunks.values()].filter((chunk) => chunk.needsReview).length,
    modules: count('module'),
    requirements: count('requirement'),
    rules: count('rule'),
  };
}
