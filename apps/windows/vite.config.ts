import { defineConfig } from 'vite';

export default defineConfig({
  clearScreen: false,
  esbuild: { jsx:'automatic' },
  server: { host:'127.0.0.1',port:1420,strictPort:true },
  envPrefix: ['VITE_'],
  build: { target:'chrome105',sourcemap:false },
});
