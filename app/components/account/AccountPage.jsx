import AccountForm from './AccountForm';
import ApiKeyCard from './ApiKeyCard';
import './AccountPage.css';

export default function AccountPage() {
  const apiKeys = [
    { label: 'Key 3', keyValue: 'rpa_50QLT9XKCB...', created: '18 Jun' },
    { label: 'Key 2', keyValue: 'rpa_6EZL8Y5IGO...', created: '14 Jun' },
    { label: 'runpodapi', keyValue: 'rpa_DGVJO39JNP...', created: '14 Jun' },
  ];

  return (
    <section className="account-page glass">
      <h1 className="page-title">⚙️ Account & Settings</h1>
      <AccountForm />
      <h2 className="section-title">🔑 API Keys</h2>
      <div className="keys-grid">
        {apiKeys.map((k) => (
          <ApiKeyCard key={k.label} label={k.label} keyValue={k.keyValue} created={k.created} />
        ))}
      </div>
    </section>
  );
}
