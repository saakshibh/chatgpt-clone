import { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { FiCopy, FiCheck } from "react-icons/fi";
import "highlight.js/styles/github-dark.css";

// Pulls the plain text out of the highlighted code element
function getText(node) {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(getText).join("");
  if (node?.props?.children) return getText(node.props.children);
  return "";
}

function CodeBlock({ children }) {
  const [copied, setCopied] = useState(false);
  const className = children?.props?.className || "";
  const lang = (/language-([\w-]+)/.exec(className) || [])[1] || "code";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(getText(children?.props?.children));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="code-block">
      <div className="code-head">
        <span>{lang}</span>
        <button className="copy-btn" onClick={copy}>
          {copied ? <FiCheck /> : <FiCopy />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>{children}</pre>
    </div>
  );
}

export default function Markdown({ children }) {
  return (
    <ReactMarkdown
      rehypePlugins={[rehypeHighlight]}
      components={{
  pre: CodeBlock,
  a: ({ node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
}}
    >
      {children}
    </ReactMarkdown>
  );
}