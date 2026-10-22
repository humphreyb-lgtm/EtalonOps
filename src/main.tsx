import {CmsProvider} from './CmsContext';
import {CmsGateway} from './CmsApplication';
import './appearance-preview';
import {GlobalDesignLoader} from './GlobalDesign';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

createRoot(document.getElementById('root')!).render(<StrictMode><CmsProvider><GlobalDesignLoader/><CmsGateway/></CmsProvider></StrictMode>);
