import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import npm2yarn from '@docusaurus/remark-plugin-npm2yarn';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const npm2yarnOptions = {
  sync: true,
  converters: ['yarn', 'pnpm'],
};

const config: Config = {
  title: 'Design Embed',
  tagline: 'Deterministic design embedding for production codebases',
  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: 'https://good-jinu.github.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/design-embed',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'good-jinu',
  projectName: 'design-embed',

  onBrokenLinks: 'throw',

  markdown: {
    format: 'detect',
  },

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          path: '../docs',
          include: ['*.md'],
          exclude: ['api/**'],
          sidebarPath: './sidebars.ts',
          remarkPlugins: [
            [npm2yarn, npm2yarnOptions],
          ],
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/good-jinu/design-embed/tree/main/docs/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      'docusaurus-plugin-typedoc',
      {
        entryPoints: [
          '../packages/design-embed',
          '../packages/plugin-figma-html',
          '../packages/target-react',
          '../packages/target-vue',
          '../packages/target-vanjs',
        ],
        sortEntryPoints: false,
        entryPointStrategy: 'packages',
        packageOptions: {
          entryPoints: ['src/index.ts'],
        },
        tsconfig: '../tsconfig.json',
        docsPath: './api',
        out: './api',
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'api',
        path: './api',
        routeBasePath: 'api',
        sidebarPath: './sidebars-api.ts',
        remarkPlugins: [[npm2yarn, npm2yarnOptions]],
      },
    ],
  ],

  themeConfig: {
    image: 'img/design-embed-social-card.webp',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Design Embed',
      logo: {
        alt: 'design-embed Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          type: 'docSidebar',
          sidebarId: 'apiSidebar',
          docsPluginId: 'api',
          position: 'left',
          label: 'API Reference',
        },
        {
          href: 'https://github.com/good-jinu/design-embed',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/getting-started',
            },
            {
              label: 'Configuration',
              to: '/docs/configuration',
            },
            {
              label: 'CLI Reference',
              to: '/docs/cli-reference',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} design-embed. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.oneLight,
      darkTheme: prismThemes.oneDark,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
