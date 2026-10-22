import {GlobalDesignLoader} from './GlobalDesign';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { CloudGate } from './cloud-auth';
import './styles.css';

createRoot(document.getElementById('root')!).render(<StrictMode><GlobalDesignLoader/><CloudGate><App /></CloudGate></StrictMode>);
