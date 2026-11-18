import {notFound} from 'next/navigation';
import {RendererLab} from '../../../../packages/client/src/workspace/renderer-lab';
export default function Page(){
  if(process.env.NODE_ENV==='production'&&process.env.AKW_RENDERER_LAB!=='1')notFound();
  return <RendererLab/>;
}
