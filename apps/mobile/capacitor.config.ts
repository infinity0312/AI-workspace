import type { CapacitorConfig } from '@capacitor/cli';

const config:CapacitorConfig = {
  appId:'com.akw.workspace',appName:'AI Knowledge Workspace',webDir:'dist',
  android:{ allowMixedContent:false,webContentsDebuggingEnabled:false },
};
export default config;
