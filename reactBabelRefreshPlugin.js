// based on https://github.com/vitejs/vite/blob/2cdb3f6cdf742e42aa62e60f8fce1dadcab225d8/packages/plugin-react-refresh/index.js

// TODO: try to prepare a PR to vite official repo with a config option to enable the babel plugins to run during the prod build

// @ts-check
const fs = require('fs')
const { transformSync, ParserOptions } = require('@babel/core')

const runtimePublicPath = '/@react-refresh'
const runtimeFilePath = require.resolve(
  'react-refresh/cjs/react-refresh-runtime.development.js'
)

const runtimeCode = `
const exports = {}
${fs.readFileSync(runtimeFilePath, 'utf-8')}
function debounce(fn, delay) {
  let handle
  return () => {
    clearTimeout(handle)
    handle = setTimeout(fn, delay)
  }
}
exports.performReactRefresh = debounce(exports.performReactRefresh, 16)
export default exports
`

const preambleCode = `
import RefreshRuntime from "__BASE__${runtimePublicPath.slice(1)}"
RefreshRuntime.injectIntoGlobalHook(window)
window.$RefreshReg$ = () => {}
window.$RefreshSig$ = () => (type) => type
window.__vite_plugin_react_preamble_installed__ = true
`

/**
 * Transform plugin for transforming files with babel and injecting per-file refresh code for react-fast refresh.
 * @param {*} opts accepts {reactRefreshInDev: boolean}, defaults to {reactRefreshInDev: true}
 * @type {import('.').default}
 */
function reactBabelRefreshPlugin(opts = { reactRefreshInDev: true }) {
  let base = '/'
  let disableRefresh = !opts.reactRefreshInDev

  return {
    name: 'react-refresh',

    enforce: 'pre',

    configResolved(config) {
      disableRefresh = config.command === 'build' || config.isProduction
      base = config.base
    },

    resolveId(id) {
      if (id === runtimePublicPath) {
        return id
      }
    },

    load(id) {
      if (id === runtimePublicPath) {
        return runtimeCode
      }
    },

    transform(code, id, ssr) {
      if (ssr) {
        return
      }

      if (!/\.(t|j)sx?$/.test(id) || id.includes('node_modules')) {
        return
      }

      // plain js/ts files can't use React without importing it, so skip
      // them whenever possible
      if (!id.endsWith('x') && !code.includes('react')) {
        return
      }

      /**
       * @type ParserOptions["plugins"]
       */
      const parserPlugins = [
        'jsx',
        'importMeta',
        // since the plugin now applies before esbuild transforms the code,
        // we need to enable some stage 3 syntax since they are supported in
        // TS and some environments already.
        'topLevelAwait',
        'classProperties',
        'classPrivateProperties',
        'classPrivateMethods',
      ]
      if (/\.tsx?$/.test(id)) {
        // it's a typescript file
        // TODO: maybe we need to read tsconfig to determine parser plugins to
        // enable here, but allowing decorators by default since it's very
        // commonly used with TS.
        parserPlugins.push('typescript', 'decorators-legacy')
      }
      if (opts.parserPlugins) {
        parserPlugins.push(...opts.parserPlugins)
      }

      const isReasonReact = id.endsWith('.bs.js')
      const result = transformSync(code, {
        configFile: false,
        filename: id,
        parserOpts: {
          sourceType: 'module',
          allowAwaitOutsideFunction: true,
          plugins: parserPlugins,
        },
        plugins: [
          require('@babel/plugin-transform-react-jsx-self'),
          require('@babel/plugin-transform-react-jsx-source'),
          disableRefresh
            ? null
            : [require('react-refresh/babel'), { skipEnvCheck: true }],
        ].filter(Boolean),
        ast: !isReasonReact,
        sourceMaps: true,
        sourceFileName: id,
      })

      if (!/\$RefreshReg\$\(/.test(result.code)) {
        // no component detected in the file
        return result.code
      }
      if (disableRefresh) {
        return result.code
      }

      const header = `
  import RefreshRuntime from "${runtimePublicPath}";
  let prevRefreshReg;
  let prevRefreshSig;
  if (!window.__vite_plugin_react_preamble_installed__) {
    throw new Error(
      "vite-plugin-react can't detect preamble. Something is wrong. " +
      "See https://github.com/vitejs/vite-plugin-react/pull/11#discussion_r430879201"
    );
  }
  if (import.meta.hot) {
    prevRefreshReg = window.$RefreshReg$;
    prevRefreshSig = window.$RefreshSig$;
    window.$RefreshReg$ = (type, id) => {
      RefreshRuntime.register(type, ${JSON.stringify(id)} + " " + id)
    };
    window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
  }`.replace(/[\n]+/gm, '')

      const footer = `
  if (import.meta.hot) {
    window.$RefreshReg$ = prevRefreshReg;
    window.$RefreshSig$ = prevRefreshSig;
    ${
      isReasonReact || isRefreshBoundary(result.ast)
        ? `import.meta.hot.accept();`
        : ``
    }
    if (!window.__vite_plugin_react_timeout) {
      window.__vite_plugin_react_timeout = setTimeout(() => {
        window.__vite_plugin_react_timeout = 0;
        RefreshRuntime.performReactRefresh();
      }, 30);
    }
  }`

      return {
        code: `${header}${result.code}${footer}`,
        map: result.map,
      }
    },

    transformIndexHtml() {
      if (disableRefresh) {
        return
      }

      return [
        {
          tag: 'script',
          attrs: { type: 'module' },
          children: preambleCode.replace(`__BASE__`, base),
        },
      ]
    },
  }
}

/**
 * @param {import('@babel/core').BabelFileResult['ast']} ast
 */
function isRefreshBoundary(ast) {
  // Every export must be a React component.
  return ast.program.body.every((node) => {
    if (node.type !== 'ExportNamedDeclaration') {
      return true
    }
    const { declaration, specifiers } = node
    if (declaration && declaration.type === 'VariableDeclaration') {
      return declaration.declarations.every(
        ({ id }) => id.type === 'Identifier' && isComponentishName(id.name)
      )
    }
    return specifiers.every(
      ({ exported }) =>
        exported.type === 'Identifier' && isComponentishName(exported.name)
    )
  })
}

/**
 * @param {string} name
 */
function isComponentishName(name) {
  return typeof name === 'string' && name[0] >= 'A' && name[0] <= 'Z'
}

module.exports = reactBabelRefreshPlugin
reactBabelRefreshPlugin['default'] = reactBabelRefreshPlugin
reactBabelRefreshPlugin.preambleCode = preambleCode
