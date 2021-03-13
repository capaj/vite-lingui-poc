'use strict';
var __spreadArray =
  (this && this.__spreadArray) ||
  function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
      to[j] = from[i];
    return to;
  };
exports.__esModule = true;
var R = require('ramda');
var icu_1 = require('./icu');
var utils_1 = require('./utils');
var constants_1 = require('./constants');
var pluralRuleRe = /(_[\d\w]+|zero|one|two|few|many|other)/;
var removeExtraScapedLiterals = /(?:\\(.))/;
var jsx2icuExactChoice = function (value) {
  return value.replace(/_(\d+)/, '=$1').replace(/_(\w+)/, '$1');
};
// replace whitespace before/after newline with single space
var keepSpaceRe = /\s*(?:\r\n|\r|\n)+\s*/g;
// remove whitespace before/after tag or expression
var stripAroundTagsRe = /(?:([>}])(?:\r\n|\r|\n)+\s*|(?:\r\n|\r|\n)+\s*(?=[<{]))/g;
function maybeNodeValue(node) {
  if (!node) return null;
  if (node.type === 'StringLiteral') return node.value;
  if (node.type === 'JSXAttribute') return maybeNodeValue(node.value);
  if (node.type === 'JSXExpressionContainer')
    return maybeNodeValue(node.expression);
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0)
    return node.quasis[0].value.raw;
  return null;
}
function normalizeWhitespace(text) {
  return (
    text
      .replace(stripAroundTagsRe, '$1')
      .replace(keepSpaceRe, ' ')
      // keep escaped newlines
      .replace(/\\n/g, '\n')
      .replace(/\\s/g, ' ')
      // we remove trailing whitespace inside Plural
      .replace(/(\s+})/gm, '}')
      .trim()
  );
}
var MacroJSX = /** @class */ (function () {
  function MacroJSX(_a) {
    var _this = this;
    var types = _a.types;
    this.replacePath = function (path) {
      var tokens = _this.tokenizeNode(path.node);
      var messageFormat = new icu_1['default']();
      var _a = messageFormat.fromTokens(tokens),
        messageRaw = _a.message,
        values = _a.values,
        jsxElements = _a.jsxElements;
      var message = normalizeWhitespace(messageRaw);
      var _b = _this.stripMacroAttributes(path.node),
        attributes = _b.attributes,
        id = _b.id,
        comment = _b.comment;
      if (!id && !message) {
        return;
      } else if (id && id !== message) {
        // If `id` prop already exists and generated ID is different,
        // add it as a `default` prop
        attributes.push(
          _this.types.jsxAttribute(
            _this.types.jsxIdentifier(constants_1.ID),
            _this.types.stringLiteral(id)
          )
        );
        if (process.env.NODE_ENV !== 'production') {
          if (message) {
            attributes.push(
              _this.types.jsxAttribute(
                _this.types.jsxIdentifier(constants_1.MESSAGE),
                _this.types.stringLiteral(message)
              )
            );
          }
        }
      } else {
        attributes.push(
          _this.types.jsxAttribute(
            _this.types.jsxIdentifier(constants_1.ID),
            _this.types.stringLiteral(message)
          )
        );
      }
      if (process.env.NODE_ENV !== 'production') {
        if (comment) {
          attributes.push(
            _this.types.jsxAttribute(
              _this.types.jsxIdentifier(constants_1.COMMENT),
              _this.types.stringLiteral(comment)
            )
          );
        }
      }
      // Parameters for variable substitution
      var valuesObject = Object.keys(values).map(function (key) {
        return _this.types.objectProperty(
          _this.types.identifier(key),
          values[key]
        );
      });
      if (valuesObject.length) {
        attributes.push(
          _this.types.jsxAttribute(
            _this.types.jsxIdentifier('values'),
            _this.types.jsxExpressionContainer(
              _this.types.objectExpression(valuesObject)
            )
          )
        );
      }
      // Inline elements
      if (Object.keys(jsxElements).length) {
        attributes.push(
          _this.types.jsxAttribute(
            _this.types.jsxIdentifier('components'),
            _this.types.jsxExpressionContainer(
              _this.types.objectExpression(
                Object.keys(jsxElements).map(function (key) {
                  return _this.types.objectProperty(
                    _this.types.identifier(key),
                    jsxElements[key]
                  );
                })
              )
            )
          )
        );
      }
      var newNode = _this.types.jsxElement(
        _this.types.jsxOpeningElement(
          _this.types.jsxIdentifier('Trans'),
          attributes,
          /*selfClosing*/ true
        ),
        /*closingElement*/ null,
        /*children*/ [],
        /*selfClosing*/ true
      );
      newNode.loc = path.node.loc;
      // @ts-ignore
      path.replaceWith(newNode);
    };
    this.attrName = function (names, exclude) {
      if (exclude === void 0) {
        exclude = false;
      }
      var namesRe = new RegExp('^(' + names.join('|') + ')$');
      return function (attr) {
        return exclude
          ? !namesRe.test(attr.name.name)
          : namesRe.test(attr.name.name);
      };
    };
    this.stripMacroAttributes = function (node) {
      var attributes = node.openingElement.attributes;
      var id = attributes.filter(_this.attrName([constants_1.ID]))[0];
      var message = attributes.filter(_this.attrName([constants_1.MESSAGE]))[0];
      var comment = attributes.filter(_this.attrName([constants_1.COMMENT]))[0];
      var reserved = [constants_1.ID, constants_1.MESSAGE, constants_1.COMMENT];
      if (_this.isI18nComponent(node)) {
        // no reserved prop names
      } else if (_this.isChoiceComponent(node)) {
        reserved = __spreadArray(__spreadArray([], reserved), [
          '_\\w+',
          '_\\d+',
          'zero',
          'one',
          'two',
          'few',
          'many',
          'other',
          'value',
          'offset',
        ]);
      }
      return {
        id: maybeNodeValue(id),
        message: maybeNodeValue(message),
        comment: maybeNodeValue(comment),
        attributes: attributes.filter(_this.attrName(reserved, true)),
      };
    };
    this.tokenizeNode = function (node) {
      if (_this.isI18nComponent(node)) {
        // t
        return _this.tokenizeTrans(node);
      } else if (_this.isChoiceComponent(node)) {
        // plural, select and selectOrdinal
        return _this.tokenizeChoiceComponent(node);
      } else if (_this.types.isJSXElement(node)) {
        return _this.tokenizeElement(node);
      } else {
        return _this.tokenizeExpression(node);
      }
    };
    this.tokenizeTrans = function (node) {
      return R.flatten(
        node.children
          .map(function (child) {
            return _this.tokenizeChildren(child);
          })
          .filter(Boolean)
      );
    };
    this.tokenizeChildren = function (node) {
      if (_this.types.isJSXExpressionContainer(node)) {
        var exp = node.expression;
        if (_this.types.isStringLiteral(exp)) {
          // Escape forced newlines to keep them in message.
          return {
            type: 'text',
            value: exp.value.replace(/\n/g, '\\n'),
          };
        } else if (_this.types.isTemplateLiteral(exp)) {
          var tokenize = R.pipe(
            // Don"t output tokens without text.
            R.evolve({
              quasis: R.map(function (text) {
                // Don"t output tokens without text.
                var value = text.value.raw;
                if (value === '') return null;
                return _this.tokenizeText(_this.clearBackslashes(value));
              }),
              expressions: R.map(function (exp) {
                return _this.types.isCallExpression(exp)
                  ? _this.tokenizeNode(exp)
                  : _this.tokenizeExpression(exp);
              }),
            }),
            function (exp) {
              return utils_1.zip(exp.quasis, exp.expressions);
            },
            // @ts-ignore
            R.flatten,
            R.filter(Boolean)
          );
          return tokenize(exp);
        } else if (_this.types.isJSXElement(exp)) {
          return _this.tokenizeNode(exp);
        } else {
          return _this.tokenizeExpression(exp);
        }
      } else if (_this.types.isJSXElement(node)) {
        return _this.tokenizeNode(node);
      } else if (_this.types.isJSXSpreadChild(node)) {
        // just do nothing
      } else if (_this.types.isJSXText(node)) {
        return _this.tokenizeText(node.value);
      } else {
        return _this.tokenizeText(node.value);
      }
    };
    this.tokenizeChoiceComponent = function (node) {
      var element = node.openingElement;
      var format = element.name.name.toLowerCase();
      var props = element.attributes.filter(
        _this.attrName(
          [
            constants_1.ID,
            constants_1.COMMENT,
            constants_1.MESSAGE,
            'key',
            // we remove <Trans /> react props that are not useful for translation
            'render',
            'component',
            'components',
          ],
          true
        )
      );
      var token = {
        type: 'arg',
        format: format,
        name: null,
        value: undefined,
        options: {
          offset: undefined,
        },
      };
      for (var _i = 0, props_1 = props; _i < props_1.length; _i++) {
        var attr = props_1[_i];
        var name_1 = attr.name.name;
        if (name_1 === 'value') {
          var exp = _this.types.isLiteral(attr.value)
            ? attr.value
            : attr.value.expression;
          token.name = _this.expressionToArgument(exp);
          token.value = exp;
        } else if (format !== 'select' && name_1 === 'offset') {
          // offset is static parameter, so it must be either string or number
          token.options.offset = _this.types.isStringLiteral(attr.value)
            ? attr.value.value
            : attr.value.expression.value;
        } else {
          var value = void 0;
          if (_this.types.isStringLiteral(attr.value)) {
            value = attr.value.extra.raw.replace(/(["'])(.*)\1/, '$2');
          } else {
            value = _this.tokenizeChildren(attr.value);
          }
          if (pluralRuleRe.test(name_1)) {
            token.options[jsx2icuExactChoice(name_1)] = value;
          } else {
            token.options[name_1] = value;
          }
        }
      }
      return token;
    };
    this.tokenizeElement = function (node) {
      // !!! Important: Calculate element index before traversing children.
      // That way outside elements are numbered before inner elements. (...and it looks pretty).
      var name = _this.elementIndex();
      var children = node.children
        .map(function (child) {
          return _this.tokenizeChildren(child);
        })
        .filter(Boolean);
      node.children = [];
      node.openingElement.selfClosing = true;
      return {
        type: 'element',
        name: name,
        value: node,
        children: children,
      };
    };
    this.tokenizeExpression = function (node) {
      return {
        type: 'arg',
        name: _this.expressionToArgument(node),
        value: node,
      };
    };
    this.tokenizeText = function (value) {
      return {
        type: 'text',
        value: value,
      };
    };
    this.expressionToArgument = function (exp) {
      return _this.types.isIdentifier(exp) ? exp.name : _this.expressionIndex();
    };
    /**
     * Custom matchers
     */
    this.isIdentifier = function (node, name) {
      return _this.types.isIdentifier(node, { name: name });
    };
    this.isI18nComponent = function (node, name) {
      if (name === void 0) {
        name = 'Trans';
      }
      return (
        _this.types.isJSXElement(node) &&
        _this.types.isJSXIdentifier(node.openingElement.name, {
          name: name,
        })
      );
    };
    this.isChoiceComponent = function (node) {
      return (
        _this.isI18nComponent(node, 'Plural') ||
        _this.isI18nComponent(node, 'Select') ||
        _this.isI18nComponent(node, 'SelectOrdinal')
      );
    };
    this.types = types;
    this.expressionIndex = utils_1.makeCounter();
    this.elementIndex = utils_1.makeCounter();
  }
  /**
   * We clean '//\` ' to just '`'
   * */
  MacroJSX.prototype.clearBackslashes = function (value) {
    return value.replace(removeExtraScapedLiterals, '`');
  };
  return MacroJSX;
})();
exports['default'] = MacroJSX;
