import React from "react";
import { ExternalLink } from "lucide-react";

interface LinkifiedTextProps {
    text: string;
    className?: string;
    showIcon?: boolean;
}

// Regex to detect URLs (http, https, www)
const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<>"'`]+[^\s<>"'`,:;.)\]!?]/gi;

export function extractUrls(text: string): string[] {
    if (!text) return [];
    const matches = text.match(URL_REGEX);
    if (!matches) return [];
    // Deduplicate and clean URLs
    return Array.from(new Set(matches));
}

export function formatHref(url: string): string {
    if (url.startsWith("http://") || url.startsWith("https://")) {
        return url;
    }
    return `https://${url}`;
}

export function LinkifiedText({ text, className, showIcon = true }: LinkifiedTextProps) {
    if (!text) return null;

    const parts: (string | React.ReactNode)[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    // Reset regex index
    const regex = new RegExp(URL_REGEX);

    while ((match = regex.exec(text)) !== null) {
        const matchIndex = match.index;
        const matchedUrl = match[0];

        if (matchIndex > lastIndex) {
            parts.push(text.substring(lastIndex, matchIndex));
        }

        const href = formatHref(matchedUrl);

        parts.push(
            <a
                key={`${matchIndex}-${matchedUrl}`}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[#a8e6cf] hover:text-[#2d936c] underline underline-offset-2 break-all inline-flex items-center gap-0.5 font-medium transition-colors cursor-pointer"
            >
                <span>{matchedUrl}</span>
                {showIcon && <ExternalLink className="w-3 h-3 inline-block shrink-0 opacity-70" />}
            </a>
        );

        lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }

    return (
        <div className={`whitespace-pre-wrap break-words ${className || ""}`}>
            {parts}
        </div>
    );
}
