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
var metaOptions = ['id', 'comment', 'props'];
var escapedMetaOptionsRe = new RegExp('^_(' + metaOptions.join('|') + ')$');
function ICUMessageFormat() {}
exports['default'] = ICUMessageFormat;
ICUMessageFormat.prototype.fromTokens = function (tokens) {
  var _this = this;
  return (Array.isArray(tokens) ? tokens : [tokens])
    .map(function (token) {
      return _this.processToken(token);
    })
    .filter(Boolean)
    .reduce(
      function (props, message) {
        return __assign(__assign({}, message), {
          message: props.message + message.message,
          values: __assign(__assign({}, props.values), message.values),
          jsxElements: __assign(
            __assign({}, props.jsxElements),
            message.jsxElements
          ),
        });
      },
      {
        message: '',
        values: {},
        jsxElements: {},
      }
    );
};
ICUMessageFormat.prototype.processToken = function (token) {
  var _a, _b;
  var _this = this;
  var jsxElements = {};
  if (token.type === 'text') {
    return {
      message: token.value,
    };
  } else if (token.type === 'arg') {
    if (
      token.value !== undefined &&
      token.value.type === 'JSXEmptyExpression'
    ) {
      return null;
    }
    var values_1 =
      token.value !== undefined
        ? ((_a = {}), (_a[token.name] = token.value), _a)
        : {};
    switch (token.format) {
      case 'plural':
      case 'select':
      case 'selectordinal':
        var formatOptions = Object.keys(token.options)
          .filter(function (key) {
            return token.options[key] != null;
          })
          .map(function (key) {
            var value = token.options[key];
            key = key.replace(escapedMetaOptionsRe, '$1');
            if (key === 'offset') {
              // offset has special syntax `offset:number`
              return 'offset:' + value;
            }
            if (typeof value !== 'string') {
              // process tokens from nested formatters
              var _a = _this.fromTokens(value),
                message = _a.message,
                childValues = _a.values,
                childJsxElements = _a.jsxElements;
              Object.assign(values_1, childValues);
              Object.assign(jsxElements, childJsxElements);
              value = message;
            }
            return key + ' {' + value + '}';
          })
          .join(' ');
        return {
          message:
            '{' + token.name + ', ' + token.format + ', ' + formatOptions + '}',
          values: values_1,
          jsxElements: jsxElements,
        };
      default:
        return {
          message: '{' + token.name + '}',
          values: values_1,
        };
    }
  } else if (token.type === 'element') {
    var message_1 = '';
    var elementValues_1 = {};
    Object.assign(jsxElements, ((_b = {}), (_b[token.name] = token.value), _b));
    token.children.forEach(function (child) {
      var _a = _this.fromTokens(child),
        childMessage = _a.message,
        childValues = _a.values,
        childJsxElements = _a.jsxElements;
      message_1 += childMessage;
      Object.assign(elementValues_1, childValues);
      Object.assign(jsxElements, childJsxElements);
    });
    return {
      message: token.children.length
        ? '<' + token.name + '>' + message_1 + '</' + token.name + '>'
        : '<' + token.name + '/>',
      values: elementValues_1,
      jsxElements: jsxElements,
    };
  }
  throw new Error('Unknown token type ' + token.type);
};
