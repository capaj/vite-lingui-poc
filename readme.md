# Vite + Lingui.js POC

Showcase how to make lingui.js work with Vite.
For babel macros to work correctly we need babel transpilation.

Solution proposed in this POC is to use a reactBabelRefreshPlugin which is mostly exact to what the official `@vitejs/plugin-react-refresh` is, but with a tweak that enables the babel transformation even in production builds.
Alternative solution would be to use https://github.com/itsMapleLeaf/vite-plugin-babel-macros together with `@vitejs/plugin-react-refresh`, but this would be slower, because the code needs to be parsed 2x instead of just once.

To run this on your machine, just install deps and run `npm run dev`.
