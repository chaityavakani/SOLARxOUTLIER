import { createRoot } from 'react-dom/client';
import App from './app/App.jsx';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('The application root element was not found.');
}

createRoot(rootElement).render(<App />);
