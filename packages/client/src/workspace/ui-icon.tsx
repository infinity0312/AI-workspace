import type { CSSProperties } from 'react';

const paths:Record<string,string> = {
  home:'m3 10 9-7 9 7v10H3Z M9 20v-7h6v7',
  projects:'M3 7h7l2 2h9v12H3Z M3 7V3h7l2 2h9v4',
  sources:'M5 3h14v18H5Z M8 7h8 M8 11h8 M8 15h5',
  activity:'M3 12h4l3-8 4 16 3-8h4',
  search:'M20 20l-5-5 M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
  settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',
  graph:'M5 5h4v4H5Z M15 15h4v4h-4Z M15 3h4v4h-4Z M9 7l6-2 M8 9l8 6',
  study:'m2 9 10-5 10 5-10 5Z M6 11v6q6 5 12 0v-6 M22 9v8',
  arrow:'M5 12h14 m-6-6 6 6-6 6',
  plus:'M12 5v14 M5 12h14',
  menu:'M4 6h16 M4 12h16 M4 18h16',
  close:'m6 6 12 12 M6 18 18 6',
};
export function UIIcon({ name,style }:{ name:string;style?:CSSProperties }) {
  return <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}><path d={paths[name] ?? paths.sources} /></svg>;
}
