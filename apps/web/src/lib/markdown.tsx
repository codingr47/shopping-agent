import { ReactNode } from "react";

function parseInline(text: string): ReactNode[] {
  const result: ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Push preceding plain text
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }

    // Push matched element
    if (match[1]) {
      // **bold**
      result.push(<strong key={result.length}>{match[1]}</strong>);
    } else if (match[2]) {
      // *italic*
      result.push(<em key={result.length}>{match[2]}</em>);
    } else if (match[3]) {
      // _italic_
      result.push(<em key={result.length}>{match[3]}</em>);
    }

    lastIndex = regex.lastIndex;
  }

  // Push remaining plain text
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result.length === 0 ? [text] : result;
}

interface Block {
  type: "paragraph" | "ul" | "ol";
  lines: string[];
}

function parseBlocks(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let currentBlock: Block | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Blank line: end current block
    if (!trimmed) {
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      continue;
    }

    // Bullet list item
    if (/^[-*]\s+/.test(trimmed)) {
      if (!currentBlock || currentBlock.type !== "ul") {
        if (currentBlock) blocks.push(currentBlock);
        currentBlock = { type: "ul", lines: [] };
      }
      currentBlock.lines.push(trimmed.replace(/^[-*]\s+/, ""));
      continue;
    }

    // Numbered list item
    if (/^\d+\.\s+/.test(trimmed)) {
      if (!currentBlock || currentBlock.type !== "ol") {
        if (currentBlock) blocks.push(currentBlock);
        currentBlock = { type: "ol", lines: [] };
      }
      currentBlock.lines.push(trimmed.replace(/^\d+\.\s+/, ""));
      continue;
    }

    // Plain text line
    if (!currentBlock || currentBlock.type !== "paragraph") {
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = { type: "paragraph", lines: [] };
    }
    currentBlock.lines.push(trimmed);
  }

  if (currentBlock) {
    blocks.push(currentBlock);
  }

  return blocks;
}

export function renderMarkdown(text: string): ReactNode[] {
  const blocks = parseBlocks(text);
  const result: ReactNode[] = [];

  blocks.forEach((block, blockIdx) => {
    if (block.type === "paragraph") {
      const content = block.lines.map((line, lineIdx) => [
        parseInline(line),
        lineIdx < block.lines.length - 1 ? <br key={`br-${lineIdx}`} /> : null,
      ]);
      result.push(
        <p key={blockIdx} className="markdown-p">
          {content}
        </p>,
      );
    } else if (block.type === "ul") {
      const items = block.lines.map((line, itemIdx) => (
        <li key={itemIdx}>{parseInline(line)}</li>
      ));
      result.push(
        <ul key={blockIdx} className="markdown-ul">
          {items}
        </ul>,
      );
    } else if (block.type === "ol") {
      const items = block.lines.map((line, itemIdx) => (
        <li key={itemIdx}>{parseInline(line)}</li>
      ));
      result.push(
        <ol key={blockIdx} className="markdown-ol">
          {items}
        </ol>,
      );
    }
  });

  return result.length === 0 ? [text] : result;
}
