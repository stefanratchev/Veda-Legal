import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = join(__dirname, '..', 'src', 'app');

// Read the SVG icon
const svgPath = join(appDir, 'icon.svg');
const svgBuffer = readFileSync(svgPath);

// The icon is taller than wide (28x34.5), so we scale to fill the square
// by scaling based on width and cropping height slightly
const iconWidth = 28;
const iconHeight = 34.5;

// Generate apple-icon.png (180x180) - use cover to fill, centered
await sharp(svgBuffer)
  .resize(180, 180, { fit: 'cover', position: 'center' })
  .png()
  .toFile(join(appDir, 'apple-icon.png'));

console.log('✓ Generated apple-icon.png (180x180)');

// Generate favicon sizes for ICO - use cover to maximize icon size
const sizes = [16, 32, 48];
const pngBuffers = await Promise.all(
  sizes.map(size =>
    sharp(svgBuffer)
      .resize(size, size, { fit: 'cover', position: 'center' })
      .png()
      .toBuffer()
  )
);

// Create ICO file manually (ICO format is relatively simple)
// ICO Header: 6 bytes
// ICO Directory Entry: 16 bytes per image
// PNG data follows

function createIco(pngBuffers, sizes) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);      // Reserved
  header.writeUInt16LE(1, 2);      // Type: 1 = ICO
  header.writeUInt16LE(pngBuffers.length, 4); // Number of images

  const dirEntries = [];
  let offset = 6 + (16 * pngBuffers.length); // After header and all directory entries

  for (let i = 0; i < pngBuffers.length; i++) {
    const entry = Buffer.alloc(16);
    const size = sizes[i];
    entry.writeUInt8(size < 256 ? size : 0, 0);  // Width (0 means 256)
    entry.writeUInt8(size < 256 ? size : 0, 1);  // Height (0 means 256)
    entry.writeUInt8(0, 2);         // Color palette
    entry.writeUInt8(0, 3);         // Reserved
    entry.writeUInt16LE(1, 4);      // Color planes
    entry.writeUInt16LE(32, 6);     // Bits per pixel
    entry.writeUInt32LE(pngBuffers[i].length, 8);  // Size of PNG data
    entry.writeUInt32LE(offset, 12); // Offset to PNG data
    dirEntries.push(entry);
    offset += pngBuffers[i].length;
  }

  return Buffer.concat([header, ...dirEntries, ...pngBuffers]);
}

const icoBuffer = createIco(pngBuffers, sizes);
writeFileSync(join(appDir, 'favicon.ico'), icoBuffer);

console.log('✓ Generated favicon.ico (16x16, 32x32, 48x48)');
console.log('\nFavicons generated successfully!');
