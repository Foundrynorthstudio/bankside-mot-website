// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://banksidemot.co.uk',
  trailingSlash: 'never',
  adapter: node({ mode: 'standalone' }),
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      external: ['node:sqlite', 'nodemailer'],
    },
  },
});
