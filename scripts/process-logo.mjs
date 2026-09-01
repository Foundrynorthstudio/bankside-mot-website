import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const source = resolve(
  process.env.HOME,
  '.cursor/projects/Users-jeremiewarner-bankside-mot-website/assets/Bankside_MOT_and_Repair-13895782-a2a7-4285-b576-84476a901b33.jpg',
);
const publicDir = resolve(process.cwd(), 'public');
const imagesDir = resolve(publicDir, 'images');
mkdirSync(imagesDir, { recursive: true });

copyFileSync(source, resolve(imagesDir, 'logo-source.jpg'));

const trimmed = sharp(source).trim({ threshold: 12 }).png({ compressionLevel: 9 });
const full = await trimmed.toBuffer();
const fullMeta = await sharp(full).metadata();

await sharp(full)
  .resize({ width: 900, withoutEnlargement: true })
  .png({ compressionLevel: 9 })
  .toFile(resolve(imagesDir, 'logo.png'));

const markSize = Math.round(Math.min(fullMeta.width, fullMeta.height) * 0.4);
const markLeft = Math.round((fullMeta.width - markSize) / 2);
const markTop = Math.max(0, Math.round(fullMeta.height * 0.02));
const mark = await sharp(full)
  .extract({
    left: markLeft,
    top: markTop,
    width: markSize,
    height: markSize,
  })
  .png()
  .toBuffer();

await sharp(mark).resize(512, 512).png({ compressionLevel: 9 }).toFile(resolve(imagesDir, 'logo-mark.png'));
await sharp(mark).resize(32, 32).png({ compressionLevel: 9 }).toFile(resolve(publicDir, 'favicon.png'));
await sharp(mark).resize(180, 180).png({ compressionLevel: 9 }).toFile(resolve(publicDir, 'apple-touch-icon.png'));

const ogLogo = await sharp(full).resize({ height: 430 }).png().toBuffer();
const ogLogoMeta = await sharp(ogLogo).metadata();
const og = sharp({
  create: {
    width: 1200,
    height: 630,
    channels: 3,
    background: '#0f172a',
  },
})
  .composite([
    {
      input: Buffer.from(
        `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width="12" height="630" fill="#115d50"/>
          <rect x="40" y="70" width="${(ogLogoMeta.width ?? 400) + 48}" height="490" rx="24" fill="#ffffff"/>
          <text x="560" y="250" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="800" fill="#ffffff">Class 4 &amp; Class 7 MOT tests</text>
          <text x="560" y="310" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="600" fill="#34d399">Falkirk · Castlelaurie Industrial Estate</text>
          <text x="560" y="430" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="500" fill="#94a3b8">Servicing · Diagnostics · Transparent pricing</text>
        </svg>`,
      ),
      top: 0,
      left: 0,
    },
    { input: ogLogo, top: 100, left: 64 },
  ]);

await og.png().toFile(resolve(publicDir, 'og-image.png'));

console.log('Logo assets written', {
  full: `${fullMeta.width}x${fullMeta.height}`,
  mark: `${markSize}x${markSize} @ ${markLeft},${markTop}`,
});
