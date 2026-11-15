import type { MetadataRoute } from 'next';

export default function manifest():MetadataRoute.Manifest {
  return {
    name:'AI Knowledge Workspace',short_name:'知识工作台',description:'可编辑、可追溯的学习与研究工作台',
    lang:'zh-CN',start_url:'/',scope:'/',display:'standalone',background_color:'#f5f7fa',theme_color:'#eff3f8',
    icons:[{ src:'/icon-192.png',sizes:'192x192',type:'image/png' },{ src:'/icon-512.png',sizes:'512x512',type:'image/png' }],
  };
}
