export type PlatformKind = 'web'|'windows'|'macos'|'android'|'ios'|'harmonyos';
export type StoreName = 'documents'|'metadata';
export interface PlatformRequest {
  path: string;
  method: string;
  body?: string;
  key?: string;
  signal: AbortSignal;
}
export interface NativeFile { id: string; name: string; size: number }
export interface ImportSelection { files: NativeFile[]; skipped: number }
export interface PlatformAdapter {
  readonly kind: PlatformKind;
  readonly capabilities: {
    readonly nativeFilePicker: boolean;
    readonly nativeFileDrop: boolean;
    readonly clipboard: boolean;
    readonly notification: boolean;
    readonly separateWindows: boolean;
    readonly sqlite: boolean;
  };
  request(input: PlatformRequest): Promise<{ status: number; body: string }>;
  file?: {
    pick(directory: boolean): Promise<ImportSelection>;
    read(file: NativeFile): Promise<string>;
    discard(file: NativeFile): Promise<void>;
    subscribe(listener: (selection: ImportSelection) => void): Promise<() => void>;
  };
  clipboard?: { read(): Promise<string>; write(text: string): Promise<void> };
  notifications?: { show(title: string, message: string): Promise<void>; activity(active: number): Promise<void> };
  windows?: {
    openArtifact(workspace: string, artifact: string): Promise<void>;
    onQuickCapture(listener: () => void): Promise<() => void>;
    quickCaptureKey?(): Promise<string | null>;
  };
  storage?: {
    read(store: StoreName, key: string): Promise<string | null>;
    list(store: StoreName): Promise<string[]>;
    compareExchange(store: StoreName, key: string, expected: string | null, value: string): Promise<boolean>;
  };
  download?(path: string): Promise<boolean>;
  openExternal?(url: string): Promise<void>;
}
const web: PlatformAdapter = {
  kind:'web',
  capabilities:{ nativeFilePicker:false,nativeFileDrop:false,clipboard:true,notification:false,separateWindows:false,sqlite:false },
  async request(input) {
    const response = await fetch('/api' + input.path,{
      method:input.method, body:input.body, signal:input.signal,cache:'no-store',
      headers:{
        ...(input.body !== undefined ? { 'Content-Type':'application/json' } : {}),
        ...(input.key ? { 'Idempotency-Key':input.key } : {}),
      },
    });
    return { status:response.status,body:await response.text() };
  },
  clipboard:{ read:() => navigator.clipboard.readText(),write:text => navigator.clipboard.writeText(text) },
};
let active = web;
export function installPlatform(platform: PlatformAdapter) { active = platform; }
export function getPlatform() { return active; }
