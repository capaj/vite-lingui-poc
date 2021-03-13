'use strict';
var __assign =
  (this && this.__assign) ||
  function () {
    __assign =
      Object.assign ||
      function (t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s)
            if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
      };
    return __assign.apply(this, arguments);
  };
exports.__esModule = true;
var R = require('ramda');
var icu_1 = require('./icu');
var utils_1 = require('./utils');
var constants_1 = require('./constants');
var keepSpaceRe = /(?:\\(?:\r\n|\r|\n))+\s+/g;
var keepNewLineRe = /(?:\r\n|\r|\n)+\s+/g;
var removeExtraScapedLiterals = /(?:\\(.))/g;
function normalizeWhitespace(text) {
  return text.replace(keepSpaceRe, ' ').replace(keepNewLineRe, '\n').trim();
}
var MacroJs = /** @class */ (function () {
  function MacroJs(_a, _b) {
    var _this = this;
    var types = _a.types;
    var i18nImportName = _b.i18nImportName;
    this.replacePathWithMessage = function (path, _a) {
      var id = _a.id,
        message = _a.message,
        values = _a.values,
        comment = _a.comment;
      var args = [];
      var options = [];
      var messageNode = isString(message)
        ? _this.types.stringLiteral(message)
        : message;
      if (id) {
        args.push(_this.types.stringLiteral(id));
        if (process.env.NODE_ENV !== 'production') {
          options.push(
            _this.types.objectProperty(
              _this.types.identifier(constants_1.MESSAGE),
              messageNode
            )
          );
        }
      } else {
        args.push(messageNode);
      }
      if (comment) {
        options.push(
          _this.types.objectProperty(
            _this.types.identifier(constants_1.COMMENT),
            _this.types.stringLiteral(comment)
          )
        );
      }
      if (Object.keys(values).length || options.length) {
        var valuesObject = Object.keys(values).map(function (key) {
          return _this.types.objectProperty(
            _this.types.identifier(key),
            values[key]
          );
        });
        args.push(_this.types.objectExpression(valuesObject));
      }
      if (options.length) {
        args.push(_this.types.objectExpression(options));
      }
      var newNode = _this.types.callExpression(
        _this.types.memberExpression(
          _this.types.identifier(_this.i18nImportName),
          _this.types.identifier('_')
        ),
        args
      );
      // preserve line number
      newNode.loc = path.node.loc;
      path.addComment('leading', constants_1.EXTRACT_MARK);
      // @ts-ignore
      path.replaceWith(newNode);
    };
    this.replacePath = function (path) {
      // reset the expression counter
      _this._expressionIndex = utils_1.makeCounter();
      if (_this.isDefineMessage(path.node)) {
        _this.replaceDefineMessage(path);
        return;
      }
      if (
        _this.types.isCallExpression(path.node) &&
        _this.isIdentifier(path.node.callee, 't')
      ) {
        _this.replaceTAsFunction(path);
        return;
      }
      var tokens = _this.tokenizeNode(path.node);
      var messageFormat = new icu_1['default']();
      var _a = messageFormat.fromTokens(tokens),
        messageRaw = _a.message,
        values = _a.values,
        id = _a.id,
        comment = _a.comment;
      var message = normalizeWhitespace(messageRaw);
      _this.replacePathWithMessage(path, {
        id: id,
        message: message,
        values: values,
        comment: comment,
      });
    };
    /**
     * macro `defineMessage` is called with MessageDescriptor. The only
     * thing that happens is that any macros used in `message` property
     * are replaced with formatted message.
     *
     * import { defineMessage, plural } from '@lingui/macro';
     * const message = defineMessage({
     *   id: "msg.id",
     *   comment: "Description",
     *   message: plural(value, { one: "book", other: "books" })
     * })
     *
     * ↓ ↓ ↓ ↓ ↓ ↓
     *
     * const message = {
     *   id: "msg.id",
     *   comment: "Description",
     *   message: "{value, plural, one {book} other {books}}"
     * }
     *
     */
    this.replaceDefineMessage = function (path) {
      // reset the expression counter
      _this._expressionIndex = utils_1.makeCounter();
      var descriptor = _this.processDescriptor(path.node.arguments[0]);
      path.replaceWith(descriptor);
    };
    /**
     * macro `t` is called with MessageDescriptor, after that
     * we create a new node to append it to i18n._
     */
    this.replaceTAsFunction = function (path) {
      var descriptor = _this.processDescriptor(path.node.arguments[0]);
      var newNode = _this.types.callExpression(
        _this.types.memberExpression(
          _this.types.identifier(_this.i18nImportName),
          _this.types.identifier('_')
        ),
        [descriptor]
      );
      path.replaceWith(newNode);
    };
    /**
     * `processDescriptor` expand macros inside messsage descriptor.
     * Message descriptor is used in `defineMessage`.
     *
     * {
     *   comment: "Description",
     *   message: plural("value", { one: "book", other: "books" })
     * }
     *
     * ↓ ↓ ↓ ↓ ↓ ↓
     *
     * {
     *   comment: "Description",
     *   id: "{value, plural, one {book} other {books}}"
     * }
     *
     */
    this.processDescriptor = function (descriptor) {
      _this.types.addComment(descriptor, 'leading', constants_1.EXTRACT_MARK);
      var messageIndex = descriptor.properties.findIndex(function (property) {
        return property.key.name === constants_1.MESSAGE;
      });
      if (messageIndex === -1) {
        return descriptor;
      }
      // if there's `message` property, replace macros with formatted message
      var node = descriptor.properties[messageIndex];
      // Inside message descriptor the `t` macro in `message` prop is optional.
      // Template strings are always processed as if they were wrapped by `t`.
      var tokens = _this.types.isTemplateLiteral(node.value)
        ? _this.tokenizeTemplateLiteral(node.value)
        : _this.tokenizeNode(node.value, true);
      var messageNode = node.value;
      if (tokens != null) {
        var messageFormat = new icu_1['default']();
        var _a = messageFormat.fromTokens(tokens),
          messageRaw = _a.message,
          values = _a.values;
        var message = normalizeWhitespace(messageRaw);
        messageNode = _this.types.stringLiteral(message);
        _this.addValues(descriptor.properties, values);
      }
      // Don't override custom ID
      var hasId =
        descriptor.properties.findIndex(function (property) {
          return property.key.name === constants_1.ID;
        }) !== -1;
      descriptor.properties[messageIndex] = _this.types.objectProperty(
        _this.types.identifier(hasId ? constants_1.MESSAGE : constants_1.ID),
        messageNode
      );
      return descriptor;
    };
    this.addValues = function (obj, values) {
      var valuesObject = Object.keys(values).map(function (key) {
        return _this.types.objectProperty(
          _this.types.identifier(key),
          values[key]
        );
      });
      if (!valuesObject.length) return;
      obj.push(
        _this.types.objectProperty(
          _this.types.identifier('values'),
          _this.types.objectExpression(valuesObject)
        )
      );
    };
    this.tokenizeNode = function (node, ignoreExpression) {
      if (ignoreExpression === void 0) {
        ignoreExpression = false;
      }
      if (_this.isI18nMethod(node)) {
        // t
        return _this.tokenizeTemplateLiteral(node);
      } else if (_this.isChoiceMethod(node)) {
        // plural, select and selectOrdinal
        return [_this.tokenizeChoiceComponent(node)];
        // } else if (isFormatMethod(node.callee)) {
        //   // date, number
        //   return transformFormatMethod(node, file, props, root)
      } else if (!ignoreExpression) {
        return _this.tokenizeExpression(node);
      }
    };
    /**
     * `node` is a TemplateLiteral. node.quasi contains
     * text chunks and node.expressions contains expressions.
     * Both arrays must be zipped together to get the final list of tokens.
     */
    this.tokenizeTemplateLiteral = function (node) {
      var tokenize = R.pipe(
        R.evolve({
          quasis: R.map(function (text) {
            // Don't output tokens without text.
            var value = text.value.raw;
            if (value === '') return null;
            return {
              type: 'text',
              value: _this.clearBackslashes(value),
            };
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
        R.flatten,
        R.filter(Boolean)
      );
      return tokenize(
        _this.types.isTaggedTemplateExpression(node) ? node.quasi : node
      );
    };
    this.tokenizeChoiceComponent = function (node) {
      var format = node.callee.name.toLowerCase();
      var token = __assign(
        __assign({}, _this.tokenizeExpression(node.arguments[0])),
        {
          format: format,
          options: {
            offset: undefined,
          },
        }
      );
      var props = node.arguments[1].properties;
      for (var _i = 0, props_1 = props; _i < props_1.length; _i++) {
        var attr = props_1[_i];
        var key = attr.key;
        // name is either:
        // NumericLiteral => convert to `={number}`
        // StringLiteral => key.value
        // Literal => key.name
        var name_1 = _this.types.isNumericLiteral(key)
          ? '=' + key.value
          : key.name || key.value;
        if (format !== 'select' && name_1 === 'offset') {
          token.options.offset = attr.value.value;
        } else {
          var value = void 0;
          if (_this.types.isTemplateLiteral(attr.value)) {
            value = _this.tokenizeTemplateLiteral(attr.value);
          } else if (_this.types.isCallExpression(attr.value)) {
            value = _this.tokenizeNode(attr.value);
          } else {
            value = attr.value.value;
          }
          token.options[name_1] = value;
        }
      }
      return token;
    };
    this.tokenizeExpression = function (node) {
      if (_this.isArg(node)) {
        return {
          type: 'arg',
          name: node.arguments[0].value,
        };
      }
      return {
        type: 'arg',
        name: _this.expressionToArgument(node),
        value: node,
      };
    };
    this.expressionToArgument = function (exp) {
      if (_this.types.isIdentifier(exp)) {
        return exp.name;
      } else if (_this.types.isStringLiteral(exp)) {
        return exp.value;
      } else {
        return _this._expressionIndex();
      }
    };
    /**
     * Custom matchers
     */
    this.isIdentifier = function (node, name) {
      return _this.types.isIdentifier(node, { name: name });
    };
    this.isDefineMessage = function (node) {
      return (
        _this.types.isCallExpression(node) &&
        _this.isIdentifier(node.callee, 'defineMessage')
      );
    };
    this.isArg = function (node) {
      return (
        _this.types.isCallExpression(node) &&
        _this.isIdentifier(node.callee, 'arg')
      );
    };
    this.isI18nMethod = function (node) {
      return (
        _this.isIdentifier(node.tag, 't') ||
        (_this.types.isCallExpression(node.tag) &&
          _this.isIdentifier(node.tag.callee, 't'))
      );
    };
    this.isChoiceMethod = function (node) {
      return (
        _this.types.isCallExpression(node) &&
        (_this.isIdentifier(node.callee, 'plural') ||
          _this.isIdentifier(node.callee, 'select') ||
          _this.isIdentifier(node.callee, 'selectOrdinal'))
      );
    };
    this.types = types;
    this.i18nImportName = i18nImportName;
    this._expressionIndex = utils_1.makeCounter();
  }
  /**
   * We clean '//\` ' to just '`'
   */
  MacroJs.prototype.clearBackslashes = function (value) {
    return value.replace(removeExtraScapedLiterals, '`');
  };
  return MacroJs;
})();
exports['default'] = MacroJs;
var isString = function (s) {
  return typeof s === 'string';
};
