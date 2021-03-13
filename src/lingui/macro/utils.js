'use strict';
exports.__esModule = true;
exports.makeCounter = exports.zip = void 0;
var R = require('ramda');
/**
 * Custom zip method which takes length of the larger array
 * (usually zip functions use the `smaller` length, discarding values in larger array)
 */
function zip(a, b) {
  return R.range(0, Math.max(a.length, b.length)).map(function (index) {
    return [a[index], b[index]];
  });
}
exports.zip = zip;
var makeCounter = function (index) {
  if (index === void 0) {
    index = 0;
  }
  return function () {
    return index++;
  };
};
exports.makeCounter = makeCounter;
