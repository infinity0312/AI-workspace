import { useEffect, useState } from 'react';

export type Preferences = { theme:'system'|'light'|'dark'; reopen:boolean; density:'comfortable'|'compact' };
const defaults:Preferences = { theme:'system',reopen:true,density:'comfortable' };
const storageKey = 'akw-preferences-v1';

export function usePreferences() {
  const [value,setValue] = useState(defaults);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as Partial<Preferences>|null;
      if (!stored) return;
      setValue({
        theme:stored.theme === 'dark' || stored.theme === 'light' ? stored.theme : 'system',
        reopen:stored.reopen !== false,
        density:stored.density === 'compact' ? 'compact' : 'comfortable',
      });
    } catch { /* Use defaults if preferences are unavailable. */ }
  },[]);
  useEffect(() => {
    const system = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => { document.documentElement.dataset.theme = value.theme === 'system' ? system.matches ? 'dark' : 'light' : value.theme; };
    apply();
    system.addEventListener('change',apply);
    return () => system.removeEventListener('change',apply);
  },[value.theme]);
  function update(next:Preferences) {
    localStorage.setItem(storageKey,JSON.stringify(next));
    setValue(next);
  }
  return { value,update };
}

export function reopenLastDocument() {
  try { return JSON.parse(localStorage.getItem(storageKey) ?? '{}')?.reopen !== false; }
  catch { return true; }
}

export function PreferencesPanel({ value,update }:{ value:Preferences; update:(value:Preferences)=>void }) {
  return <section className="panel stack">
    <h2>此设备的显示偏好</h2>
    <div className="field-grid">
      <label>外观<select value={value.theme} onChange={event => update({ ...value,theme:event.target.value as Preferences['theme'] })}>
        <option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option>
      </select></label>
      <label>导航密度<select value={value.density} onChange={event => update({ ...value,density:event.target.value as Preferences['density'] })}>
        <option value="comfortable">常规</option><option value="compact">紧凑</option>
      </select></label>
    </div>
    <label className="check"><input type="checkbox" checked={value.reopen} onChange={event => update({ ...value,reopen:event.target.checked })} />启动时恢复上次打开的文档</label>
  </section>;
}
