'use strict';
exports.__esModule = true;
var babel_plugin_macros_1 = require('babel-plugin-macros');
var macroJs_1 = require('./macroJs');
var macroJsx_1 = require('./macroJsx');
var config = {
  runtimeConfigModule: {
    i18n: ['@lingui/core', 'i18n'],
  },
};
var getSymbolSource = function (name) {
  if (Array.isArray(config.runtimeConfigModule)) {
    if (name === 'i18n') {
      return config.runtimeConfigModule;
    } else {
      return ['@lingui/react', name];
    }
  } else {
    if (
      Object.prototype.hasOwnProperty.call(config.runtimeConfigModule, name)
    ) {
      return config.runtimeConfigModule[name];
    } else {
      return ['@lingui/react', name];
    }
  }
};
var _a = getSymbolSource('i18n'),
  i18nImportModule = _a[0],
  _b = _a[1],
  i18nImportName = _b === void 0 ? 'i18n' : _b;
var _c = getSymbolSource('Trans'),
  TransImportModule = _c[0],
  _d = _c[1],
  TransImportName = _d === void 0 ? 'Trans' : _d;
function macro(_a) {
  var references = _a.references,
    state = _a.state,
    babel = _a.babel;
  var jsxNodes = [];
  var jsNodes = [];
  Object.keys(references).forEach(function (tagName) {
    var nodes = references[tagName];
    var macroType = getMacroType(tagName);
    if (macroType == null) {
      throw nodes[0].buildCodeFrameError('Unknown macro ' + tagName);
    }
    if (macroType === 'js') {
      nodes.forEach(function (node) {
        jsNodes.push(node.parentPath);
      });
    } else {
      nodes.forEach(function (node) {
        // identifier.openingElement.jsxElement
        jsxNodes.push(node.parentPath.parentPath);
      });
    }
  });
  jsNodes.filter(isRootPath(jsNodes)).forEach(function (path) {
    if (alreadyVisited(path)) return;
    var macro = new macroJs_1['default'](babel, {
      i18nImportName: i18nImportName,
    });
    macro.replacePath(path);
  });
  jsxNodes.filter(isRootPath(jsxNodes)).forEach(function (path) {
    if (alreadyVisited(path)) return;
    var macro = new macroJsx_1['default'](babel);
    macro.replacePath(path);
  });
  if (jsNodes.length) {
    addImport(babel, state, i18nImportModule, i18nImportName);
  }
  if (jsxNodes.length) {
    addImport(babel, state, TransImportModule, TransImportName);
  }
  if (process.env.LINGUI_EXTRACT === '1') {
    return {
      keepImports: true,
    };
  }
}
function addImport(babel, state, module, importName) {
  var t = babel.types;
  var linguiImport = state.file.path.node.body.find(function (importNode) {
    return (
      t.isImportDeclaration(importNode) &&
      importNode.source.value === module &&
      // https://github.com/lingui/js-lingui/issues/777
      importNode.importKind !== 'type'
    );
  });
  var tIdentifier = t.identifier(importName);
  // Handle adding the import or altering the existing import
  if (linguiImport) {
    if (
      linguiImport.specifiers.findIndex(function (specifier) {
        return specifier.imported && specifier.imported.name === importName;
      }) === -1
    ) {
      linguiImport.specifiers.push(t.importSpecifier(tIdentifier, tIdentifier));
    }
  } else {
    state.file.path.node.body.unshift(
      t.importDeclaration(
        [t.importSpecifier(tIdentifier, tIdentifier)],
        t.stringLiteral(module)
      )
    );
  }
}
function isRootPath(allPath) {
  return function (node) {
    return (function traverse(path) {
      if (!path.parentPath) {
        return true;
      } else {
        return !allPath.includes(path.parentPath) && traverse(path.parentPath);
      }
    })(node);
  };
}
var alreadyVisitedCache = [];
function alreadyVisited(path) {
  if (alreadyVisitedCache.includes(path)) {
    return true;
  } else {
    alreadyVisitedCache.push(path);
    return false;
  }
}
function getMacroType(tagName) {
  switch (tagName) {
    case 'defineMessages':
    case 'defineMessage':
    case 'arg':
    case 't':
    case 'plural':
    case 'select':
    case 'selectOrdinal':
      return 'js';
    case 'Trans':
    case 'Plural':
    case 'Select':
    case 'SelectOrdinal':
      return 'jsx';
  }
}
exports['default'] = babel_plugin_macros_1.createMacro(macro);
