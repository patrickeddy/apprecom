// REQUIRES
const fs = require('fs');

// CONSTANTS
const RULES_FILENAME = "apprecom_rules.txt";
const RULES_ENCODING = "utf-8";

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
class AppRecom{

  /**
   * Instantiate an AppRecom object for training and fetching recommendations.
   * @param {Boolean} debug - option for console log debugging
   * @param {String} rulesDirectory - the directory to save the rules to.
   */
  constructor(debug = false, rulesDirectory = "./node_modules/apprecom/"){
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
   * @returns {Promise}
   */
  train(data, min_support = 0.1, min_conf = 0.9){
    return new Promise((res, rej)=>{
      // Get the data organized so that we can find associations.
      const optimalItemset = this._getOptimalItemset(data, min_support);
      const rules = this._getRules(data, optimalItemset, min_conf); // get the rules
      this.rules  = rules // set the rules for the object

      fs.writeFile(this.rulesDirectory + RULES_FILENAME, jstr(rules), (err)=>{
        if (err){
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
  getApps(location){
    return new Promise((res, rej)=>{
      if (this.DEBUG){
        print("==============\nRECOMMENDATIONS DEBUG\n"); print(`Location is: ${location}`);
      }
      fs.readFile(this.rulesDirectory + RULES_FILENAME, RULES_ENCODING, (err, data)=>{
        if (err){
          rej(err); // error if couldn't read
        } else {
          const rules = parse(data); // get the rules object
          if (this.DEBUG) print(`Fetched rules are: ${jstr(rules)}`);
          const appRecommendations = rules[location] ? rules[location] : [];
          if (this.DEBUG) print(`Recommendations:\n${jstr(appRecommendations)}`);
          res(appRecommendations);
        }
        if (this.DEBUG) print("\n==============");
      });
    });
  }

  /**
   * Gets the optimal itemsets with the specified minimum support.
   * @private
   * @param {Array<Object>} data - the data to find itemsets on
   * @param {Decimal} min_support - the minimum support percentage to include this item set
   * @returns {Set} optimal itemset
   */
  _getOptimalItemset(data, min_support){
    return this._itemsetPrune(this._countItemsets(data), data.length, min_support);
  }

  /**
   * Prunes the itemsets for those who match the min_support
   * @private
   * @param {Map<String, Number>} itemsets - item entry as JSON Array, item frequency
   * @param {Number} length - length of the original data
   * @param {Number} min_support - the minimum support accepted for an itemset
   * @returns {Set<String>} keepers - returns a set of itemset JSON Arrays
   */
  _itemsetPrune(itemsetSupport, length, min_support){
    const keepers = new Map(itemsetSupport);
    for ([instance, support] of itemsetSupport){
      if ((support / length) < min_support) keepers.delete(instance); // keep this value because it satisfies the min support.
    }
    if (this.DEBUG) print(`==============\nITEMSET DEBUG\n${jstr([...itemsetSupport]).replace(/],\[\"\[/g, "],\n\[\"\[")}\n==============`); // debug log
    return [...keepers.keys()]; // return only the keys
  }

  /**
   * Counts the number of itemsets in the data.
   * @private
   * @param {Array<Object>} data - the data to count the itemsets on
   * @returns {Map<String, Number>} itemsetSupport - the itemset numbers
   */
  _countItemsets(data){
    const itemsetSupport = new Map();
    data.forEach((instance)=>{
      const mapKey = jstr([instance.pcat, instance.acat]);
      if (!itemsetSupport.has(mapKey)) itemsetSupport.set(mapKey, 0); // fill in the map value
      itemsetSupport.set(mapKey, itemsetSupport.get(mapKey) + 1); // increment this instance by one in the map
    });
    return itemsetSupport;
  }

  /**
   * Gets the rules from the itemsets according to the minimum confidence.
   * @private
   * @param {Array<Object>} ogData - the original data to count value frequencies on
   * @param {Array<Object>} itemsets - the itemsets to fetch rules from.
   * @param {Decimal} min_conf - the minimum confidence for a rule to be accepted
   * @returns {Object} rules
   */
  _getRules(ogData, itemsets, min_conf){
    const rules = {};
    itemsets.forEach((itemset)=>{
      const arr = parse(itemset);
      let hyp = arr[0];
      let con = arr[1];
      if (this._valueFreq(ogData, hyp) / this._valueFreq(ogData, con) >= min_conf) this._addRules(rules, hyp, con); // could do this recursively,
      else if (this._valueFreq(ogData, con) / this._valueFreq(ogData, hyp) >= min_conf) this._addRules(rules, con, hyp); // but in our case our data will only have 2 attributes
    });
    if (this.DEBUG) print(`==============\nRULES DEBUG\n${jstr(rules)
        .replace("{", "{\n")
        .replace("}", "\n}")
        .replace("],", "],\n")}\n==============`);
    return rules;
  }

  /**
   * Returns the frequency of a certain value in the original data
   * @private
   */
  _valueFreq(ogData, value){
    let count = 0;
    ogData.forEach((instance)=>{
      if (instance.pcat == value || instance.acat == value) count++;
    });
    return count;
  }

  /**
   * Adds the rules to the rules array by their hypothesis conclusion format.
   * @private
   */
  _addRules(rules, hyp, con){
    if (rules[hyp]) rules[hyp].push(con); // if a value already exists, append
    else rules[hyp] = [con]; // otherwise set
    return rules;
  }
}

// HELPER FUNCTIONS
function print(str){
  console.log(str);
}

function jstr(obj){
  return JSON.stringify(obj);
}

function parse(string){
  return JSON.parse(string);
}

// Module export
export default AppRecom;
