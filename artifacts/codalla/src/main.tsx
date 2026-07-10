import { createRoot } from 'react-dom/client';

import App from './App';

import './index.css';

// Codalla defaults to dark mode (Replit-style)
document.documentElement.classList.add('dark');

createRoot(document.getElementById('root')!).render(<App />);
