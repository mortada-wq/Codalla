import { useState } from 'react';

export default function ApiKeyCard({ label, keyValue, created }) {
  const [copied, setCopied] = useState(false);

  const copyKey = () => {
    navigator.clipboard.writeText(keyValue).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="api-key-card glass">
      <div className="key-header">{label}</div>
      <div className="key-body">
        <code>{keyValue}</code>
        <button className="copy-btn" onClick={copyKey}>
          {copied ? '✅ Copied' : 'Copy'}
        </button>
      </div>
      <div className="key-meta">
        <span>{created}</span>
        <button className="revoke-btn">Revoke</button>
      </div>
    </div>
  );
}
