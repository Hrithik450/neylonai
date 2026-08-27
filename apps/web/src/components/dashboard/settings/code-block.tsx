"use client";

import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomOneLight } from "react-syntax-highlighter/dist/cjs/styles/hljs";

interface CodeBlockProps {
  code: string;
  language?: "typescript" | "bash" | "javascript" | "json" | "text" | "html";
  label?: string;
}

export function CodeBlock({ code, language = "typescript", label }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--ink)]/20 bg-white">
      {label && (
        <div className="flex items-center justify-between gap-3 border-b border-[var(--ink)]/10 px-4 py-3 bg-[var(--cream)]/20">
          <h4 className="font-medium text-sm">{label}</h4>
          <button
            type="button"
            className="btn-ink flex size-8 items-center justify-center bg-white p-0 rounded-md hover:bg-[var(--cream)]/40 transition-colors"
            onClick={() => void copyCode()}
            aria-label={copied ? "Code copied" : "Copy code"}
            title={copied ? "Copied" : "Copy"}
          >
            {copied ? (
              <Check className="size-4 text-green-600" aria-hidden />
            ) : (
              <Copy className="size-4" aria-hidden />
            )}
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <SyntaxHighlighter
          language={language}
          style={atomOneLight}
          customStyle={{
            margin: 0,
            padding: "1rem",
            fontSize: "0.875rem",
            lineHeight: "1.5rem",
            backgroundColor: "transparent",
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
