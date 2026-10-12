// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://banksidemot.com',
  trailingSlash: 'never',
  adapter: cloudflare({
    imageService: 'passthrough',
  }),
  vite: {
    plugins: [tailwindcss()],
  },
});
