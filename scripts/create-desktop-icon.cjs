const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { deflateSync } = require('node:zlib');
const dir = join(__dirname,'..','apps','windows','src-tauri','icons');
mkdirSync(dir,{ recursive:true });
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i=0;i<8;i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(name,data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(name),data]);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc32(body));
  return Buffer.concat([length,body,sum]);
}
function png(size) {
  const rgba = Buffer.alloc((size*4 + 1)*size);
  for (let y=0;y<size;y++) for (let x=0;x<size;x++) {
    const xx = (x+.5)/size;
    const yy = (y+.5)/size;
    const round = Math.hypot(Math.max(0,.18-xx,xx-.82),Math.max(0,.18-yy,yy-.82)) <= .16;
    const rise = (yy-.24)/.52;
    const a = yy >= .24 && yy <= .76 && (Math.abs(xx-(.5-.23*rise))<.046 || Math.abs(xx-(.5+.23*rise))<.046);
    const cross = xx > .365 && xx < .635 && yy > .55 && yy < .61;
    const at = y*(size*4+1)+1+x*4;
    rgba.set(a || cross ? [247,243,226,255] : [57,74,199,round ? 255 : 0],at);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size);
  header.writeUInt32BE(size,4);
  header[8]=8; header[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rgba)),chunk('IEND',Buffer.alloc(0))]);
}
const sizes = [16,32,48,256];
const entries = sizes.map(png);
const index = Buffer.alloc(6+16*sizes.length);
index.writeUInt16LE(1,2);
index.writeUInt16LE(sizes.length,4);
let offset=index.length;
for (const [i,size] of sizes.entries()) {
  const at=6+i*16;
  index[at]=size%256;
  index[at+1]=size%256;
  index.writeUInt16LE(1,at+4);
  index.writeUInt16LE(32,at+6);
  index.writeUInt32LE(entries[i].length,at+8);
  index.writeUInt32LE(offset,at+12);
  offset += entries[i].length;
}
writeFileSync(join(dir,'icon.ico'),Buffer.concat([index,...entries]));
