import { Rule, RuleResult, ScanContext } from "../types.js";

const MAX_PENALTY = 10;
const PENALTY_PER_BLOCK = 3;
const MIN_BLOCK_LINES = 4;

interface CommentBlock {
  startLine: number;
  endLine: number;
  lines: string[];
}

function findCommentedBlocks(content: string): CommentBlock[] {
  const lines = content.split("\n");
  const blocks: CommentBlock[] = [];
  let currentBlock: CommentBlock | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const isCommentLine =
      /^\/\//.test(trimmed) || /^#/.test(trimmed) || /^\*/.test(trimmed) || /^\/\*/.test(trimmed);

    // Also detect lines inside block comments (/* ... */)
    const isInsideBlockComment =
      trimmed.includes("/*") || trimmed.includes("*/") || /^\s*\*/.test(line);

    if (isCommentLine || isInsideBlockComment) {
      if (currentBlock) {
        currentBlock.lines.push(trimmed);
        currentBlock.endLine = i + 1;
      } else {
        currentBlock = {
          startLine: i + 1,
          endLine: i + 1,
          lines: [trimmed],
        };
      }
    } else {
      // Check if this is a continuation of a block comment with */ on its own line
      if (currentBlock && trimmed.includes("*/")) {
        currentBlock.lines.push(trimmed);
        currentBlock.endLine = i + 1;
      }
      // End current block
      if (currentBlock) {
        if (currentBlock.lines.length >= MIN_BLOCK_LINES) {
          blocks.push(currentBlock);
        }
        currentBlock = null;
      }
    }
  }

  // Check if the last block qualifies
  if (currentBlock && currentBlock.lines.length >= MIN_BLOCK_LINES) {
    blocks.push(currentBlock);
  }

  return blocks;
}

const rule: Rule = {
  id: "commented-code",
  title: "Commented-out code blocks",
  description:
    "Detects large blocks of commented-out code (4+ consecutive lines) that should be removed rather than left in the codebase.",
  severity: "warning",
  category: "incomplete-implementation",
  scorePenalty: PENALTY_PER_BLOCK,
  docUrl: "https://repoproof.dev/docs/rules/commented-code",

  async run(context: ScanContext): Promise<RuleResult[]> {
    try {
      const findings: RuleResult[] = [];
      let totalPenalty = 0;

      for (const file of context.files) {
        if (totalPenalty >= MAX_PENALTY) break;

        const blocks = findCommentedBlocks(file.content);
        for (const block of blocks) {
          if (totalPenalty >= MAX_PENALTY) break;

          findings.push({
            id: this.id,
            title: this.title,
            description: `Found ${block.lines.length} consecutive lines of commented code`,
            severity: "warning",
            category: "incomplete-implementation",
            evidence: [
              {
                file: file.relativePath,
                line: block.startLine,
                snippet: block.lines.slice(0, 3).join("; ").substring(0, 120),
              },
            ],
            remediation: "Remove commented-out code.",
            scorePenalty: PENALTY_PER_BLOCK,
            docUrl: this.docUrl,
          });
          totalPenalty += PENALTY_PER_BLOCK;
        }
      }

      return findings;
    } catch {
      return [];
    }
  },
};

export { rule };
