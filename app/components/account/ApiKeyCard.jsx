import { useState } from 'react';

function maskKey(keyValue) {
  const visible = keyValue.replace(/\.\.\.$/, '').slice(-4);
  return `••••••••${visible}`;
}

export default function ApiKeyCard({ label, keyValue, created, onRevoke }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const copyKey = () => {
    navigator.clipboard
      .writeText(keyValue)
      .then(() => {
        setCopyFailed(false);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        setCopyFailed(true);
        setTimeout(() => setCopyFailed(false), 1500);
      });
  };

  const revokeKey = () => {
    if (window.confirm(`Revoke "${label}"? This cannot be undone.`)) {
      onRevoke?.();
    }
  };

  return (
    <div className="api-key-card glass">
      <div className="key-header">{label}</div>
      <div className="key-body">
        <code>{revealed ? keyValue : maskKey(keyValue)}</code>
        <button className="reveal-btn" onClick={() => setRevealed((r) => !r)}>
          {revealed ? 'Hide' : 'Reveal'}
        </button>
        <button className="copy-btn" onClick={copyKey}>
          {copyFailed ? '⚠️ Failed' : copied ? '✅ Copied' : 'Copy'}
        </button>
      </div>
      <div className="key-meta">
        <span>{created}</span>
        <button className="revoke-btn" onClick={revokeKey}>
          Revoke
        </button>
      </div>
    </div>
  );
}
