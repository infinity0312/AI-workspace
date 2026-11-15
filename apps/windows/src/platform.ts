import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { ImportSelection, PlatformAdapter } from '@akw/client';

export const windowsPlatform: PlatformAdapter = {
  kind:'windows',
  capabilities:{ nativeFilePicker:true,nativeFileDrop:true,clipboard:true,notification:true,separateWindows:true,sqlite:true },
  async request({ path,method,body,key,signal }) {
    signal.throwIfAborted();
    return new Promise((resolve,reject) => {
      const abort = () => reject(signal.reason);
      signal.addEventListener('abort',abort,{ once:true });
      void invoke<{ status:number;body:string }>('backend_request',{ request:{ path,method,body,key } })
        .then(resolve,reject).finally(() => signal.removeEventListener('abort',abort));
    });
  },
  file:{
    pick: directory => invoke('pick_import_files',{ directory }),
    read: file => invoke('read_import_file',{ id:file.id }),
    discard: file => invoke('discard_import_file',{ id:file.id }),
    subscribe: handler => listen<ImportSelection>('akw-file-drop',event => handler(event.payload)),
  },
  clipboard:{
    read: () => invoke('read_clipboard'),
    write: text => invoke('write_clipboard',{ text }),
  },
  notifications:{
    show: (title,message) => invoke('show_notification',{ title,message }),
    activity: active => invoke('set_research_activity',{ active }),
  },
  windows:{
    openArtifact: (workspace,artifact) => invoke('open_artifact_window',{ workspace,artifact }),
    onQuickCapture: handler => listen('akw-quick-capture',handler),
    quickCaptureKey: () => invoke('quick_capture_shortcut'),
  },
  storage:{
    read: (store,key) => invoke('sqlite_read',{ store,key }),
    list: store => invoke('sqlite_list',{ store }),
    compareExchange: (store,key,expected,value) => invoke('sqlite_compare_exchange',{ store,key,expected,value }),
  },
  download: path => invoke('save_download',{ path }),
  openExternal: url => invoke('open_public_link',{ url }),
};
