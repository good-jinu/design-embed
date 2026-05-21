import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const rawTypedocSidebar = require('./api/typedoc-sidebar.cjs');

const sidebars: SidebarsConfig = {
  apiSidebar: rawTypedocSidebar,
};

export default sidebars;
