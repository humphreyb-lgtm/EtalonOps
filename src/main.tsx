import {LoginPage} from './LoginPage';
import './appearance-preview';
import {GlobalDesignLoader} from './GlobalDesign';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { CloudGate } from './cloud-auth';
import './styles.css';

const loginPreview=window.parent!==window&&new URLSearchParams(location.search).has('appearancePreview')&&new URLSearchParams(location.search).get('appearancePage')==='login';
createRoot(document.getElementById('root')!).render(<StrictMode><GlobalDesignLoader/><CloudGate>{loginPreview?<LoginPage microsoft={async()=>{}} onSite={()=>{}} busy={false} error=""/>:<App />}</CloudGate></StrictMode>);
