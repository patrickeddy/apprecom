"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// REQUIRES
var fs = require('fs');

// CONSTANTS
var RULES_FILENAME = "apprecom_rules.txt";
var RULES_ENCODING = "utf-8";

/**
 * <p>AppRecom is a tool for getting app recommendations based on a user's location.</p>
 *
 * <p>
 * The two primary methods in this class are:
 * <ul>
 * <li><strong>train(..)</strong></li>
 * <li><strong>getAppsFor(..)</strong></li>
 * </ul>
 *
 * For specific information about each method, check the method documentation.
 */

var AppRecom = function () {

  /**
   * Instantiate an AppRecom object for training and fetching recommendations.
   * @param {Boolean} debug - option for console log debugging
   * @param {String} rulesDirectory - the directory to save the rules to.
   */
  function AppRecom() {
    var debug = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
    var rulesDirectory = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "./node_modules/apprecom/";

    _classCallCheck(this, AppRecom);

    this.rulesDirectory = rulesDirectory;
    this.itemsets = [];
    this.rules = [];
    this.DEBUG = debug;
  }

  /**
   * <p>Train the recommender against a data set. Entries in the data array look like:</p>
   * <p>
   * {pname: "Place Name", pcat: "Place Category", aname: "App Name", acat: "App Category"}
   * </p>
   *
   * <p>This method returns a JavaScript Promise.</p>
   *
   * @param {Array<Object>} data - data to find association rules on.
   * @param {Decimal} min_support - the minimum support percentage for an itemset (0.0 - 1.0)
   * @param {Decimal} min_conf - the minimum confidence percentage for a rule (0.0 - 1.0)
   * @param {Number} testRatio - ratio of training data to test data (0.0 - 1.0)
   * @returns {Promise}
   */


  _createClass(AppRecom, [{
    key: "train",
    value: function train(data) {
      var min_support = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0.02;

      var _this = this;

      var min_conf = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0.8;
      var testRatio = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0.8;

      return new Promise(function (res, rej) {
        // TRAIN AND TEST
        _this._testData(data, min_support, min_conf, testRatio, 5);
        // DONE TESTING

        // Get final rules using all data
        var optimalItemset = _this._getOptimalItemset(data, min_support);
        var rules = _this._getRules(data, optimalItemset, min_conf); // get the rules
        _this.rules = rules; // set the rules for the object

        fs.writeFile(_this.rulesDirectory + RULES_FILENAME, jstr(rules), function (err) {
          if (err) {
            rej(err);
          } else {
            res();
          }
        }); // save the rules
      });
    }

    /**
     * <p>Retrieves app category recommendations that best fit this location as an array. [train()]{@link AppRecom#train} must be called before this function.</p>
     * <p>This function returns a JavaScript Promise.</p>
     *
     * @param {String} locationCategory - the category of the location (e.g. 'cafe')
     * @returns {Promise} appCategories - the categories of apps that match this location
     */

  }, {
    key: "getApps",
    value: function getApps(location) {
      var _this2 = this;

      return new Promise(function (res, rej) {
        fs.readFile(_this2.rulesDirectory + RULES_FILENAME, RULES_ENCODING, function (err, data) {
          if (err) {
            rej(err); // error if couldn't read
          } else {
            var rules = parse(data); // get the rules object
            var appRecommendations = rules[location] ? rules[location] : [];
            res(appRecommendations);
          }
        });
      });
    }

    /**
     * Tests the learning by splitting into training and testing data and verifying results.
     * @private
     */

  }, {
    key: "_testData",
    value: function _testData(data, min_support, min_conf, testRatio, rounds) {
      var averageError = 0;

      // Determines an integer # for training instances
      var numTraining = Math.round(data.length * testRatio);

      for (var count = 0; count < rounds; count++) {
        var shuffleData = data.slice();
        shuffleData = shuffle(shuffleData);

        // Training and Testing data
        var trainingSet = [];
        for (var i = 0; i <= numTraining; i++) {
          var item = shuffleData.pop();
          trainingSet.push(item);
        }
        var testingItemset = shuffleData;
        // Training rules
        var trainingItemset = this._getOptimalItemset(trainingSet, min_support);
        var trainingRules = this._getRules(trainingSet, trainingItemset, min_conf);

        // Logs
        if (this.DEBUG) print("==============\nUNKNOWN TEST\ndata length: " + data.length + " - training length: " + trainingSet.length + " - testing length: " + testingItemset.length + "\n");

        // Get the error rate for this data.
        var error = this._testTrainingSet(trainingRules, testingItemset);
        averageError += error;
        if (this.DEBUG) print("Round " + (count + 1) + " unknown rate: " + error);
      }
      averageError = Math.round(averageError / rounds * 100) / 100;
      if (this.DEBUG) print("\nAverage unknown rate: " + averageError);
    }

    /**
     * Gets the optimal itemsets with the specified minimum support.
     * @private
     * @param {Array<Object>} data - the data to find itemsets on
     * @param {Decimal} min_support - the minimum support percentage to include this item set
     * @returns {Set} optimal itemset
     */

  }, {
    key: "_getOptimalItemset",
    value: function _getOptimalItemset(data, min_support) {
      return this._itemsetPrune(this._countItemsets(data), data.length, min_support);
    }

    /**
     * Prunes the itemsets for those who match the min_support
     * @private
     * @param {Map<String, Number>} itemsets - item entry as JSON Array, item frequency
     * @param {Number} length - length of the original data
     * @param {Number} min_support - the minimum support accepted for an itemset
     * @returns {Map<String, Number>} keepers - a map of rules and support
     */

  }, {
    key: "_itemsetPrune",
    value: function _itemsetPrune(itemsetSupport, length, min_support) {
      var keepers = new Map(itemsetSupport);
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = itemsetSupport[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var _ref = _step.value;

          var _ref2 = _slicedToArray(_ref, 2),
              instance = _ref2[0],
              support = _ref2[1];

          if (support / length < min_support) keepers.delete(instance); // keep this value because it satisfies the min support.
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      if (this.DEBUG) print("==============\nITEMSET DEBUG\n" + jstr([].concat(_toConsumableArray(itemsetSupport))).replace(/],\[\"\[/g, "],\n\[\"\[") + "\n=============="); // debug log
      return keepers; // return the keepers with their supports
    }

    /**
     * Counts the number of itemsets in the data.
     * @private
     * @param {Array<Object>} data - the data to count the itemsets on
     * @returns {Map<String, Number>} itemsetSupport - the itemset numbers
     */

  }, {
    key: "_countItemsets",
    value: function _countItemsets(data) {
      var itemsetSupport = new Map();
      data.forEach(function (instance) {
        var mapKey = jstr([instance.pcat, instance.acat]);
        if (!itemsetSupport.has(mapKey)) itemsetSupport.set(mapKey, 0); // fill in the map value
        itemsetSupport.set(mapKey, itemsetSupport.get(mapKey) + 1); // increment this instance by one in the map
      });
      return itemsetSupport;
    }

    /**
     * Determines the quality of the classifier by testing the trainingSet for the error rate.
     * @private
     * @returns ratio of incorrectly classified instances
     */

  }, {
    key: "_testTrainingSet",
    value: function _testTrainingSet(rules, testingSet) {
      var total = 0;
      var numIncorrect = 0;
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = testingSet[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var _instance = _step2.value;

          if (rules[_instance.pcat]) {
            // if we have a rule for it, lets count it
            total++;
            var correct = false;
            if (this.DEBUG) print(total + ". place cat: " + _instance.pcat);
            correct = rules[_instance.pcat].indexOf(_instance.acat) != -1; // check the equality of the app part of the itemset
            if (this.DEBUG) print("rule apps: " + rules[_instance.pcat] + "\ninstance app: " + _instance.acat);
            if (!correct) numIncorrect++;
            if (this.DEBUG) print((correct ? "FOUND" : "UNKNOWN") + "\n");
          }
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }

      if (this.DEBUG) print("\nTotal: " + total + "\nUnknown: " + numIncorrect);
      var errorrate = numIncorrect / total;
      return errorrate != 0 ? Math.round(errorrate * 100) / 100 : 0;
    }

    /**
     * Gets the rules from the itemsets according to the minimum confidence.
     * @private
     * @param {Array<Object>} ogData - the original data to count value frequencies on
     * @param {Map<String, Number>} itemsets - the itemsets to fetch rules from.
     * @param {Decimal} min_conf - the minimum confidence for a rule to be accepted
     * @returns {Object} rules
     */

  }, {
    key: "_getRules",
    value: function _getRules(ogData, itemsets, min_conf) {
      var _this3 = this;

      var rules = {};
      [].concat(_toConsumableArray(itemsets.keys())).forEach(function (itemset) {
        var arr = parse(itemset);
        var hyp = arr[0];
        var con = arr[1];
        var hypFreq = _this3._valueFreq(ogData, hyp);
        var conFreq = _this3._valueFreq(ogData, con);
        var count = itemsets.get(itemset);
        // print(`hypFreq: ${hypFreq} conFreq: ${conFreq}`);
        if (conFreq / hypFreq >= min_conf) _this3._addRules(rules, hyp, con, count);
      });

      if (this.DEBUG) print("==============\nRULES DEBUG\n");
      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;
      var _iteratorError3 = undefined;

      try {
        for (var _iterator3 = Object.keys(rules)[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
          var key = _step3.value;

          rules[key].sort(function (a, b) {
            return b.count - a.count;
          }); // sort the rules on count
          if (this.DEBUG) print(key + ":" + jstr(rules[key]).replace(/{/g, "{\n   ").replace(/}/g, "\n   }").replace(/],/g, "],\n") + "\n");
          for (var app in rules[key]) {
            rules[key][app] = rules[key][app].app; // strip object and count value
          }
        }
      } catch (err) {
        _didIteratorError3 = true;
        _iteratorError3 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion3 && _iterator3.return) {
            _iterator3.return();
          }
        } finally {
          if (_didIteratorError3) {
            throw _iteratorError3;
          }
        }
      }

      if (this.DEBUG) print("\n==============");
      return rules;
    }

    /**
     * Returns the frequency of a certain value in the original data
     * @private
     */

  }, {
    key: "_valueFreq",
    value: function _valueFreq(ogData, value) {
      var count = 0;
      ogData.forEach(function (instance) {
        if (instance.pcat == value || instance.acat == value) count++;
      });
      return count;
    }

    /**
     * Adds the rules to the rules array by their hypothesis conclusion format.
     * @private
     */

  }, {
    key: "_addRules",
    value: function _addRules(rules, hyp, con, count) {
      var value = { app: con, count: count };
      if (rules[hyp]) rules[hyp].push(value); // if a value already exists, append to the rules array
      else rules[hyp] = [value]; // otherwise set
      return rules;
    }
  }]);

  return AppRecom;
}();

// HELPER FUNCTIONS


function print(str) {
  console.log(str);
}

function jstr(obj) {
  return JSON.stringify(obj);
}

function parse(string) {
  return JSON.parse(string);
}

function shuffle(array) {
  /**
   * <p>Stole from Christoph on Stack Overflow:
   * {@link https://stackoverflow.com/a/962890}</p>
   */
  var tmp,
      current,
      top = array.length;

  if (top) while (--top) {
    current = Math.floor(Math.random() * (top + 1));
    tmp = array[current];
    array[current] = array[top];
    array[top] = tmp;
  }

  return array;
}

// Module export
exports.default = AppRecom;