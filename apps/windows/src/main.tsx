import React from 'react';
import { createRoot } from 'react-dom/client';
import { installPlatform, WorkspaceApp } from '@akw/client';
import '@akw/client/styles.css';
import { windowsPlatform } from './platform';

installPlatform(windowsPlatform);
const root = document.getElementById('root');
if (!root) throw new Error('Workspace mount point unavailable');
createRoot(root).render(<React.StrictMode><WorkspaceApp /></React.StrictMode>);
