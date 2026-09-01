// @ts-check
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://banksidemot.co.uk',
  trailingSlash: 'never',
  adapter: netlify(),
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      external: ['node:sqlite', 'nodemailer'],
    },
  },
});
