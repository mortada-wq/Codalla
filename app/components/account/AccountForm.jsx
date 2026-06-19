import { useState } from 'react';
import './AccountPage.css';

export default function AccountForm() {
  const [form, setForm] = useState({
    firstName: 'Mortada',
    lastName: 'Gzar',
    address1: '',
    address2: '',
    country: '',
    companyName: '',
    companyId: '',
    taxId: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted:', form);

    // TODO: integrate with Antigravity skill or Runpod API
  };

  return (
    <form className="account-form" onSubmit={handleSubmit}>
      <h2 className="section-title">👤 Profile</h2>
      <div className="grid-2">
        <label>
          First name
          <input name="firstName" value={form.firstName} onChange={handleChange} placeholder="Mortada" required />
        </label>
        <label>
          Last name
          <input name="lastName" value={form.lastName} onChange={handleChange} placeholder="Gzar" required />
        </label>
      </div>

      <h2 className="section-title">🏠 Address</h2>
      <label>
        Address line 1
        <input name="address1" value={form.address1} onChange={handleChange} placeholder="Street, number" />
      </label>
      <label>
        Address line 2
        <input name="address2" value={form.address2} onChange={handleChange} placeholder="Apartment, suite, etc." />
      </label>
      <label>
        Country
        <input name="country" value={form.country} onChange={handleChange} placeholder="Country" />
      </label>

      <h2 className="section-title">🏢 Company</h2>
      <label>
        Company name
        <input name="companyName" value={form.companyName} onChange={handleChange} placeholder="Your company" />
      </label>
      <label>
        Company ID
        <input name="companyId" value={form.companyId} onChange={handleChange} placeholder="Tax / registration ID" />
      </label>
      <label>
        Tax ID
        <input name="taxId" value={form.taxId} onChange={handleChange} placeholder="VAT / Tax number" />
      </label>

      <button className="primary-btn" type="submit">
        Save changes
      </button>
    </form>
  );
}
