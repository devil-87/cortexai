import React, { useState } from "react";
import { Check, Copy, Code2 } from "lucide-react";

// Friendly names for the label in the top bar
const LANGUAGE_NAMES = {
  js: "JavaScript",
  javascript: "JavaScript",
  jsx: "JSX",
  ts: "TypeScript",
  typescript: "TypeScript",
  tsx: "TSX",
  py: "Python",
  python: "Python",
  java: "Java",
  c: "C",
  cpp: "C++",
  cs: "C#",
  go: "Go",
  rust: "Rust",
  php: "PHP",
  html: "HTML",
  xml: "XML",
  css: "CSS",
  scss: "SCSS",
  json: "JSON",
  yaml: "YAML",
  yml: "YAML",
  sql: "SQL",
  bash: "Bash",
  sh: "Shell",
  shell: "Shell",
  powershell: "PowerShell",
  md: "Markdown",
  markdown: "Markdown",
  dockerfile: "Dockerfile",
  plaintext: "Text",
  text: "Text",
};

// Blocks in these languages (or with no language) get no line numbers
const NO_NUMBER_LANGS = ["text", "txt", "plaintext", "output", "console", "log"];

// Syntax highlighting turns the code into many nested <span>s,
// so collect their text again for the Copy button.
const getText = (node) => {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getText).join("");
  return getText(node.props?.children);
};

// Used by react-markdown as the <pre> component
const CodeBlock = ({ children }) => {
  const [copied, setCopied] = useState(false);

  const codeEl = React.Children.toArray(children)[0];
  const className = codeEl?.props?.className || "";
  const lang = /language-([\w+#-]+)/.exec(className)?.[1]?.toLowerCase();
  const label = lang ? LANGUAGE_NAMES[lang] || lang : "Code";

  // Line numbers: shown for real code, hidden for plain text / output blocks
  const rawText = getText(codeEl?.props?.children).replace(/\n$/, "");
  const lineCount = rawText.split("\n").length;
  const showLineNumbers = !!lang && !NO_NUMBER_LANGS.includes(lang);

  const handleCopy = async () => {
    try {
      const text = getText(codeEl?.props?.children).replace(/\n$/, "");
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-[var(--code-border)] bg-[var(--code-bg)]">
      {/* Top bar: language on the left, Copy on the right */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--code-border)] bg-[var(--code-header-bg)] text-xs text-slate-300">
        <span className="flex items-center gap-2 font-medium">
          <Code2 size={14} />
          {label}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white transition cursor-pointer"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="overflow-x-auto">
        <div className="flex min-w-full w-max">
          {/* Line numbers */}
          {showLineNumbers && (
            <div
              aria-hidden="true"
              className="sticky left-0 shrink-0 select-none py-4 pl-4 pr-3 text-right text-[13px] leading-[1.7] font-mono text-[var(--code-linenum)] bg-[var(--code-bg)] border-r border-[var(--code-border)]"
            >
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
          )}

          <pre className="flex-1 p-4 text-[13px] leading-[1.7] font-mono [&_code]:bg-transparent [&_code]:[color:var(--code-text)] [&_code]:p-0 [&_code]:rounded-none [&_code]:text-[13px] [&_code]:font-mono">
            {children}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default CodeBlock;