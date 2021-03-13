import { createMacro } from 'babel-plugin-macros';

import MacroJS from './macroJs';
import MacroJSX from './macroJsx';

const config = {
  runtimeConfigModule: {
    i18n: ['@lingui/core', 'i18n'],
  },
};

const getSymbolSource = (name: string) => {
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

const [i18nImportModule, i18nImportName = 'i18n'] = getSymbolSource('i18n');
const [TransImportModule, TransImportName = 'Trans'] = getSymbolSource('Trans');

function macro({ references, state, babel }) {
  const jsxNodes: any[] = [];
  const jsNodes: any[] = [];

  Object.keys(references).forEach((tagName) => {
    const nodes = references[tagName];
    const macroType = getMacroType(tagName);
    if (macroType == null) {
      throw nodes[0].buildCodeFrameError(`Unknown macro ${tagName}`);
    }

    if (macroType === 'js') {
      nodes.forEach((node: { parentPath: any }) => {
        jsNodes.push(node.parentPath);
      });
    } else {
      nodes.forEach((node: { parentPath: { parentPath: any } }) => {
        // identifier.openingElement.jsxElement
        jsxNodes.push(node.parentPath.parentPath);
      });
    }
  });

  jsNodes.filter(isRootPath(jsNodes)).forEach((path) => {
    if (alreadyVisited(path)) return;
    const macro = new MacroJS(babel, { i18nImportName });
    macro.replacePath(path);
  });

  jsxNodes.filter(isRootPath(jsxNodes)).forEach((path) => {
    if (alreadyVisited(path)) return;
    const macro = new MacroJSX(babel);
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

function addImport(
  babel: { types: any },
  state: { file: { path: { node: { body: any[] } } } },
  module: any,
  importName: any
) {
  const { types: t } = babel;

  const linguiImport = state.file.path.node.body.find(
    (importNode: { source: { value: any }; importKind: string }) =>
      t.isImportDeclaration(importNode) &&
      importNode.source.value === module &&
      // https://github.com/lingui/js-lingui/issues/777
      importNode.importKind !== 'type'
  );

  const tIdentifier = t.identifier(importName);
  // Handle adding the import or altering the existing import
  if (linguiImport) {
    if (
      linguiImport.specifiers.findIndex(
        (specifier: { imported: { name: any } }) =>
          specifier.imported && specifier.imported.name === importName
      ) === -1
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

function isRootPath(allPath: string | any[]) {
  return (node: any) =>
    (function traverse(path: any) {
      if (!path.parentPath) {
        return true;
      } else {
        return !allPath.includes(path.parentPath) && traverse(path.parentPath);
      }
    })(node);
}

const alreadyVisitedCache: any[] = [];

function alreadyVisited(path: any) {
  if (alreadyVisitedCache.includes(path)) {
    return true;
  } else {
    alreadyVisitedCache.push(path);
    return false;
  }
}

function getMacroType(tagName: string) {
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

export default createMacro(macro);
