import { createRoot } from 'react-dom/client';
import { installPlatform, WorkspaceApp } from '@akw/client';
import '@akw/client/styles.css';
import { androidPlatform } from './platform';

installPlatform(androidPlatform);
const root = document.getElementById('root');
if (!root) throw new Error('Workspace mount point unavailable');
createRoot(root).render(<WorkspaceApp />);
