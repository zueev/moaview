import {createRoot} from 'react-dom/client';
import Gate from './app/gate';
import Desk from './app/desk';
import './app/globals.css';
createRoot(document.getElementById('root')!).render(<Gate><Desk/></Gate>);
