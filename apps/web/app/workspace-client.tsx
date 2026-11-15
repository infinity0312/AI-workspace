'use client';

import { useEffect } from 'react';
import { WorkspaceApp as SharedWorkspace } from '@akw/client';

export function WorkspaceApp() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let mounted = true;
    const warm = () => navigator.serviceWorker.controller?.postMessage({
      type:'warm-shell',paths:performance.getEntriesByType('resource').map(entry => entry.name),
    });
    navigator.serviceWorker.addEventListener('controllerchange',warm);
    void navigator.serviceWorker.register('/sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then(() => { if (mounted) warm(); })
      .catch(() => {});
    return () => { mounted = false; navigator.serviceWorker.removeEventListener('controllerchange',warm); };
  },[]);
  return <SharedWorkspace />;
}
