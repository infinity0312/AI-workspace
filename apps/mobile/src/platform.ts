import { registerPlugin } from '@capacitor/core';
import type { PlatformAdapter } from '@akw/client';

type Storage = NonNullable<PlatformAdapter['storage']>;
interface WorkspaceBridge {
  request(options:{ path:string; method:string; body?:string; key?:string }):Promise<{ status:number; body:string }>;
  read(options:{ store:Parameters<Storage['read']>[0]; key:string }):Promise<{ value:string|null }>;
  list(options:{ store:Parameters<Storage['list']>[0] }):Promise<{ values:string[] }>;
  compareExchange(options:{ store:Parameters<Storage['compareExchange']>[0]; key:string; expected:string|null; value:string }):Promise<{ changed:boolean }>;
  readClipboard():Promise<{ value:string }>;
  writeClipboard(options:{ value:string }):Promise<void>;
  download(options:{ path:string }):Promise<void>;
  openExternal(options:{ url:string }):Promise<void>;
}
const bridge = registerPlugin<WorkspaceBridge>('WorkspaceBridge');

export const androidPlatform:PlatformAdapter = {
  kind:'android',
  capabilities:{ nativeFilePicker:false,nativeFileDrop:false,clipboard:true,notification:false,separateWindows:false,sqlite:true },
  async request({ signal,...request }) {
    signal.throwIfAborted();
    return new Promise((resolve,reject) => {
      const abort = () => reject(signal.reason);
      signal.addEventListener('abort',abort,{ once:true });
      void bridge.request(request).then(resolve,reject).finally(() => signal.removeEventListener('abort',abort));
    });
  },
  storage:{
    read:(store,key) => bridge.read({ store,key }).then(result => result.value),
    list:store => bridge.list({ store }).then(result => result.values),
    compareExchange:(store,key,expected,value) => bridge.compareExchange({ store,key,expected,value }).then(result => result.changed),
  },
  clipboard:{ read:() => bridge.readClipboard().then(result => result.value),write:value => bridge.writeClipboard({ value }) },
  download:path => bridge.download({ path }).then(() => true),
  openExternal:url => bridge.openExternal({ url }),
};
