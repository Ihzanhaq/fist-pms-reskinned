import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import './panels.css';
import './connect.css';
import './projects.css';
import './controls.css';
import './insights.css';
import './premium.css';
import './leaderboard.css';
import './signin.css';
import './tour.css';
import './themes.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
