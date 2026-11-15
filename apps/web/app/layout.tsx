import type { Metadata } from 'next';
import '@akw/client/styles.css';
export const metadata: Metadata = { title: 'AI Knowledge Workspace', description: '可编辑、可追溯的学习与研究工作台' };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
