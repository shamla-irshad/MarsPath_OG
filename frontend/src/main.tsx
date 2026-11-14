import {loadMapMetadata} from './mapMetadata';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
<<<<<<< HEAD
=======
import './visual-refresh.css';
>>>>>>> e40c8077cf500f1707a055744bc00b935020404b
const root=createRoot(document.getElementById('root')!);
loadMapMetadata().then(()=>root.render(<React.StrictMode><App/></React.StrictMode>)).catch(()=>root.render(<main><h1>Map data unavailable</h1><p>Map metadata could not be loaded. Reload to retry.</p><button onClick={()=>location.reload()}>Reload</button></main>));
