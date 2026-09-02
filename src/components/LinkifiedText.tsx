import React from "react";
import { ExternalLink } from "lucide-react";

interface LinkifiedTextProps {
    text: string;
    className?: string;
    showIcon?: boolean;
}

export function formatHref(url: string): string {
    if (url.startsWith("http://") || url.startsWith("https://")) {
        return url;
    }
    return `https://${url}`;
}

interface Token {
    type: "image" | "md_link" | "url" | "bold" | "italic" | "code";
    startIndex: number;
    endIndex: number;
    text: string;
    url?: string;
}

/**
 * Parses and renders inline markdown & links (bold, italic, code, markdown link, auto link, image)
 */
function renderInlineContent(text: string, showIcon = true): React.ReactNode[] {
    if (!text) return [];

    const tokens: Token[] = [];

    // 1. Markdown Images: ![Alt](https://url or www.url)
    const imgRegex = /!\[([^\]\n]*)\]\(((?:https?:\/\/|www\.)[^\s)]+)\)/gi;
    let match: RegExpExecArray | null;
    while ((match = imgRegex.exec(text)) !== null) {
        tokens.push({
            type: "image",
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            text: match[1] || "Image",
            url: formatHref(match[2]),
        });
    }

    // 2. Markdown Links: [Anchor Text](https://url or www.url)
    const mdLinkRegex = /\[([^\]\n]+)\]\(((?:https?:\/\/|www\.)[^\s)]+)\)/gi;
    while ((match = mdLinkRegex.exec(text)) !== null) {
        if (match.index > 0 && text[match.index - 1] === "!") {
            continue;
        }
        tokens.push({
            type: "md_link",
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            text: match[1],
            url: formatHref(match[2]),
        });
    }

    // 3. Raw URLs: https://... or http://... or www....
    const urlRegex = /(?:https?:\/\/|www\.)[^\s<>"'`]+[^\s<>"'`,:;.)\]!?]/gi;
    while ((match = urlRegex.exec(text)) !== null) {
        tokens.push({
            type: "url",
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            text: match[0],
            url: formatHref(match[0]),
        });
    }

    // 4. Markdown Bold: **text**
    const boldRegex = /\*\*([^*\n]+)\*\*/g;
    while ((match = boldRegex.exec(text)) !== null) {
        tokens.push({
            type: "bold",
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            text: match[1],
        });
    }

    // 5. Markdown Italic: *text* (excluding already matched bold)
    const italicRegex = /(?<!\*)\*([^*\n]+)\*(?!\*)/g;
    while ((match = italicRegex.exec(text)) !== null) {
        tokens.push({
            type: "italic",
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            text: match[1],
        });
    }

    // 6. Markdown Inline Code: `code`
    const codeRegex = /`([^`\n]+)`/g;
    while ((match = codeRegex.exec(text)) !== null) {
        tokens.push({
            type: "code",
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            text: match[1],
        });
    }

    // Sort tokens by startIndex, discard overlapping tokens
    tokens.sort((a, b) => a.startIndex - b.startIndex);
    const validTokens: Token[] = [];
    let lastEnd = 0;
    for (const token of tokens) {
        if (token.startIndex >= lastEnd) {
            validTokens.push(token);
            lastEnd = token.endIndex;
        }
    }

    const elements: React.ReactNode[] = [];
    let currentIndex = 0;

    for (let i = 0; i < validTokens.length; i++) {
        const token = validTokens[i];

        if (token.startIndex > currentIndex) {
            elements.push(text.substring(currentIndex, token.startIndex));
        }

        if (token.type === "image") {
            elements.push(
                <span key={`img-${i}-${token.startIndex}`} className="block my-2">
                    <a href={token.url} target="_blank" rel="noopener noreferrer" className="inline-block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={token.url}
                            alt={token.text}
                            className="max-w-full max-h-80 rounded-lg border border-slate-700 bg-black/40 object-contain hover:opacity-90 transition-opacity"
                            loading="lazy"
                        />
                    </a>
                </span>
            );
        } else if (token.type === "md_link" || token.type === "url") {
            elements.push(
                <a
                    key={`link-${i}-${token.startIndex}`}
                    href={token.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-blue-400 hover:text-blue-300 underline underline-offset-2 break-all inline-flex items-center gap-1 font-medium transition-colors cursor-pointer"
                >
                    <span>{token.text}</span>
                    {showIcon && <ExternalLink className="w-3.5 h-3.5 inline-block shrink-0 opacity-75" />}
                </a>
            );
        } else if (token.type === "bold") {
            elements.push(
                <strong key={`bold-${i}-${token.startIndex}`} className="font-bold text-white">
                    {renderInlineContent(token.text, showIcon)}
                </strong>
            );
        } else if (token.type === "italic") {
            elements.push(
                <em key={`italic-${i}-${token.startIndex}`} className="italic text-slate-200">
                    {renderInlineContent(token.text, showIcon)}
                </em>
            );
        } else if (token.type === "code") {
            elements.push(
                <code
                    key={`code-${i}-${token.startIndex}`}
                    className="bg-[#18181c] border border-slate-700 text-amber-300 px-1.5 py-0.5 rounded text-sm font-mono"
                >
                    {token.text}
                </code>
            );
        }

        currentIndex = token.endIndex;
    }

    if (currentIndex < text.length) {
        elements.push(text.substring(currentIndex));
    }

    return elements;
}

/**
 * Checks if a line is a markdown table separator row like |---|:---:|---|
 */
function isTableSeparator(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed.includes("|")) return false;
    const stripped = trimmed.replace(/^\|/, "").replace(/\|$/, "");
    const cells = stripped.split("|");
    if (cells.length === 0) return false;
    return cells.every(cell => /^[\s:-]+$/.test(cell) && cell.includes("-"));
}

/**
 * Splits a table line into cells handling outer pipes
 */
function parseTableCells(line: string): string[] {
    let trimmed = line.trim();
    if (trimmed.startsWith("|")) trimmed = trimmed.substring(1);
    if (trimmed.endsWith("|")) trimmed = trimmed.substring(0, trimmed.length - 1);
    return trimmed.split("|").map(c => c.trim());
}

/**
 * Renders multiline text containing markdown headings, blockquotes, tables, lists, and hr lines
 */
function renderBlockContent(text: string, showIcon = true): React.ReactNode {
    const rawLines = text.split("\n");
    const blocks: React.ReactNode[] = [];
    let i = 0;

    while (i < rawLines.length) {
        const line = rawLines[i];
        const trimmed = line.trim();

        // 1. Table Detection
        // A table starts if current line has pipes, and next line is a separator row
        if (
            trimmed.includes("|") &&
            i + 1 < rawLines.length &&
            isTableSeparator(rawLines[i + 1])
        ) {
            const headerCells = parseTableCells(line);
            i += 2; // skip header and separator

            const bodyRows: string[][] = [];
            while (i < rawLines.length && rawLines[i].trim().includes("|") && rawLines[i].trim().length > 0) {
                bodyRows.push(parseTableCells(rawLines[i]));
                i++;
            }

            blocks.push(
                <div key={`table-block-${i}`} className="my-4 overflow-x-auto rounded-lg border border-slate-700/80 shadow-md">
                    <table className="w-full text-left border-collapse bg-[#1a1a20]/90 text-sm md:text-base">
                        <thead>
                            <tr className="border-b border-slate-700 bg-slate-800/80 text-slate-100 font-semibold">
                                {headerCells.map((header, hIdx) => (
                                    <th key={hIdx} className="px-4 py-2.5 whitespace-nowrap border-r border-slate-700/60 last:border-r-0">
                                        {renderInlineContent(header, showIcon)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {bodyRows.map((row, rIdx) => (
                                <tr
                                    key={rIdx}
                                    className={rIdx % 2 === 0 ? "bg-[#202027]/50 hover:bg-slate-700/30 transition-colors" : "bg-[#1a1a20]/60 hover:bg-slate-700/30 transition-colors"}
                                >
                                    {row.map((cell, cIdx) => (
                                        <td key={cIdx} className="px-4 py-2.5 border-r border-slate-700/40 last:border-r-0 text-slate-200 leading-relaxed align-top">
                                            {/* Handle <br> tags in table cells */}
                                            {cell.split(/<br\s*\/?>/gi).map((part, pIdx, pArr) => (
                                                <React.Fragment key={pIdx}>
                                                    {renderInlineContent(part.trim(), showIcon)}
                                                    {pIdx < pArr.length - 1 && <br />}
                                                </React.Fragment>
                                            ))}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
            continue;
        }

        // 2. Horizontal Rule (---, ***, ___)
        if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
            blocks.push(<hr key={`hr-${i}`} className="my-4 border-slate-700" />);
            i++;
            continue;
        }

        // 3. Headings (# H1, ## H2, ### H3, #### H4)
        if (trimmed.startsWith("#### ")) {
            blocks.push(
                <h4 key={`h4-${i}`} className="text-base font-bold text-slate-100 mt-4 mb-1">
                    {renderInlineContent(trimmed.substring(5), showIcon)}
                </h4>
            );
            i++;
            continue;
        }
        if (trimmed.startsWith("### ")) {
            blocks.push(
                <h3 key={`h3-${i}`} className="text-lg font-bold text-slate-100 mt-4 mb-1">
                    {renderInlineContent(trimmed.substring(4), showIcon)}
                </h3>
            );
            i++;
            continue;
        }
        if (trimmed.startsWith("## ")) {
            blocks.push(
                <h2 key={`h2-${i}`} className="text-xl font-bold text-emerald-400 mt-5 mb-2 border-b border-slate-700/60 pb-1">
                    {renderInlineContent(trimmed.substring(3), showIcon)}
                </h2>
            );
            i++;
            continue;
        }
        if (trimmed.startsWith("# ")) {
            blocks.push(
                <h1 key={`h1-${i}`} className="text-2xl font-black text-white mt-4 mb-3 border-b border-slate-600 pb-2">
                    {renderInlineContent(trimmed.substring(2), showIcon)}
                </h1>
            );
            i++;
            continue;
        }

        // 4. Blockquotes (> quote)
        if (trimmed.startsWith("> ")) {
            const quoteLines: string[] = [];
            while (i < rawLines.length && rawLines[i].trim().startsWith("> ")) {
                quoteLines.push(rawLines[i].trim().substring(2));
                i++;
            }
            blocks.push(
                <blockquote key={`quote-${i}`} className="my-2 border-l-4 border-emerald-500 bg-slate-800/40 px-4 py-2 rounded-r text-slate-300 italic">
                    {quoteLines.map((qLine, qIdx) => (
                        <div key={qIdx}>{renderInlineContent(qLine, showIcon)}</div>
                    ))}
                </blockquote>
            );
            continue;
        }

        // 5. Bullet Lists (- item or * item)
        if (/^[-*]\s+/.test(trimmed)) {
            const listItems: string[] = [];
            while (i < rawLines.length && /^[-*]\s+/.test(rawLines[i].trim())) {
                listItems.push(rawLines[i].trim().replace(/^[-*]\s+/, ""));
                i++;
            }
            blocks.push(
                <ul key={`ul-${i}`} className="list-disc list-inside space-y-1 my-2 text-slate-200">
                    {listItems.map((item, itemIdx) => (
                        <li key={itemIdx} className="leading-relaxed">
                            {renderInlineContent(item, showIcon)}
                        </li>
                    ))}
                </ul>
            );
            continue;
        }

        // 6. Numbered Lists (1. item)
        if (/^\d+\.\s+/.test(trimmed)) {
            const listItems: string[] = [];
            while (i < rawLines.length && /^\d+\.\s+/.test(rawLines[i].trim())) {
                listItems.push(rawLines[i].trim().replace(/^\d+\.\s+/, ""));
                i++;
            }
            blocks.push(
                <ol key={`ol-${i}`} className="list-decimal list-inside space-y-1 my-2 text-slate-200">
                    {listItems.map((item, itemIdx) => (
                        <li key={itemIdx} className="leading-relaxed">
                            {renderInlineContent(item, showIcon)}
                        </li>
                    ))}
                </ol>
            );
            continue;
        }

        // 7. Regular paragraph / empty line
        if (trimmed === "") {
            blocks.push(<div key={`empty-${i}`} className="h-2" />);
        } else {
            blocks.push(
                <p key={`p-${i}`} className="leading-relaxed my-1">
                    {renderInlineContent(line, showIcon)}
                </p>
            );
        }
        i++;
    }

    return <div className="space-y-1">{blocks}</div>;
}

export function LinkifiedText({ text, className, showIcon = true }: LinkifiedTextProps) {
    if (!text) return null;

    return (
        <div className={`break-words leading-relaxed ${className || ""}`}>
            {renderBlockContent(text, showIcon)}
        </div>
    );
}

