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
    type: "image" | "md_link" | "url" | "bold" | "code";
    startIndex: number;
    endIndex: number;
    text: string;
    url?: string;
}

export function LinkifiedText({ text, className, showIcon = true }: LinkifiedTextProps) {
    if (!text) return null;

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
            url: formatHref(match[2])
        });
    }

    // 2. Markdown Links: [Anchor Text](https://url or www.url)
    const mdLinkRegex = /\[([^\]\n]+)\]\(((?:https?:\/\/|www\.)[^\s)]+)\)/gi;
    while ((match = mdLinkRegex.exec(text)) !== null) {
        // Skip if this was part of an image tag ![]()
        if (match.index > 0 && text[match.index - 1] === "!") {
            continue;
        }
        tokens.push({
            type: "md_link",
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            text: match[1],
            url: formatHref(match[2])
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
            url: formatHref(match[0])
        });
    }

    // 4. Markdown Bold: **text**
    const boldRegex = /\*\*([^*\n]+)\*\*/g;
    while ((match = boldRegex.exec(text)) !== null) {
        tokens.push({
            type: "bold",
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            text: match[1]
        });
    }

    // 5. Markdown Inline Code: `code`
    const codeRegex = /`([^`\n]+)`/g;
    while ((match = codeRegex.exec(text)) !== null) {
        tokens.push({
            type: "code",
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            text: match[1]
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
                    {token.text}
                </strong>
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

    return (
        <div className={`whitespace-pre-wrap break-words leading-relaxed ${className || ""}`}>
            {elements}
        </div>
    );
}
