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
   * @param {Number} testRatio - ratio of training data to test data (0.0 - 1.0)
   * @returns {Promise}
   */
  train(data, min_support = 0.02, min_conf = 0.8, testRatio = 0.8){
    return new Promise((res, rej)=>{
      // TRAIN AND TEST
      this._testData(data, min_support, min_conf, testRatio, 5);
      // DONE TESTING

      // Get final rules using all data
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
      fs.readFile(this.rulesDirectory + RULES_FILENAME, RULES_ENCODING, (err, data)=>{
        if (err){
          rej(err); // error if couldn't read
        } else {
          const rules = parse(data); // get the rules object
          const appRecommendations = rules[location] ? rules[location] : [];
          res(appRecommendations);
        }
      });
    });
  }

  /**
   * Tests the learning by splitting into training and testing data and verifying results.
   * @private
   */
  _testData(data, min_support, min_conf, testRatio, rounds){
    let averageError = 0;

    // Determines an integer # for training instances
    const numTraining = Math.round((data.length) * testRatio);

    for (let count = 0; count < rounds; count++) {
      let shuffleData = data.slice();
      shuffleData = shuffle(shuffleData);

      // Training and Testing data
      let trainingSet = [];
      for (let i = 0; i <= numTraining; i++){
        const item = shuffleData.pop();
        trainingSet.push(item);
      }
      let testingItemset = shuffleData;
      // Training rules
      const trainingItemset = this._getOptimalItemset(trainingSet, min_support);
      const trainingRules = this._getRules(trainingSet, trainingItemset, min_conf);

      // Logs
      if(this.DEBUG) print(`==============\nUNKNOWN TEST\ndata length: ${data.length} - training length: ${trainingSet.length} - testing length: ${testingItemset.length}\n`);

      // Get the error rate for this data.
      const error = this._testTrainingSet(trainingRules, testingItemset);
      averageError += error;
      if(this.DEBUG) print(`Round ${count+1} unknown rate: ${error}`);
    }
    averageError = Math.round(averageError / rounds * 100) / 100;
    if(this.DEBUG) print(`\nAverage unknown rate: ${averageError}`);
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
   * @returns {Map<String, Number>} keepers - a map of rules and support
   */
  _itemsetPrune(itemsetSupport, length, min_support){
    const keepers = new Map(itemsetSupport);
    for ([instance, support] of itemsetSupport){
      if ((support / length) < min_support) keepers.delete(instance); // keep this value because it satisfies the min support.
    }
    if (this.DEBUG) print(`==============\nITEMSET DEBUG\n${jstr([...itemsetSupport]).replace(/],\[\"\[/g, "],\n\[\"\[")}\n==============`); // debug log
    return keepers; // return the keepers with their supports
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
   * Determines the quality of the classifier by testing the trainingSet for the error rate.
   * @private
   * @returns ratio of incorrectly classified instances
   */
  _testTrainingSet(rules, testingSet){
    let total = 0;
    let numIncorrect = 0;
    for (const instance of testingSet) {
      if (rules[instance.pcat]) { // if we have a rule for it, lets count it
        total++;
        let correct = false;
        if (this.DEBUG) print(`${total}. place cat: ${instance.pcat}`);
        correct = rules[instance.pcat].indexOf(instance.acat) != -1; // check the equality of the app part of the itemset
        if (this.DEBUG) print(`rule apps: ${rules[instance.pcat]}\ninstance app: ${instance.acat}`);
        if (!correct) numIncorrect++;
        if (this.DEBUG) print(`${correct ? "FOUND" : "UNKNOWN"}\n`);
      }
    }
    if (this.DEBUG) print(`\nTotal: ${total}\nUnknown: ${numIncorrect}`);
    const errorrate = numIncorrect / total;
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
  _getRules(ogData, itemsets, min_conf){
    const rules = {};
    [...itemsets.keys()].forEach((itemset)=>{
      const arr = parse(itemset);
      let hyp = arr[0];
      let con = arr[1];
      const hypFreq = this._valueFreq(ogData, hyp);
      const conFreq = this._valueFreq(ogData, con);
      const count = itemsets.get(itemset);
      // print(`hypFreq: ${hypFreq} conFreq: ${conFreq}`);
      if ((conFreq / hypFreq) >= min_conf) this._addRules(rules, hyp, con, count);
    });

    if (this.DEBUG) print("==============\nRULES DEBUG\n");
    for (let key of Object.keys(rules)){
      rules[key].sort((a, b)=> b.count - a.count); // sort the rules on count
      if (this.DEBUG) print(`${key}:${jstr(rules[key])
          .replace(/{/g, "{\n   ")
          .replace(/}/g, "\n   }")
          .replace(/],/g, "],\n")}\n`);
      for (const app in rules[key]){
        rules[key][app] = rules[key][app].app; // strip object and count value
      }
    }
    if (this.DEBUG) print("\n==============");
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
  _addRules(rules, hyp, con, count){
    const value = {app: con, count: count};
    if (rules[hyp]) rules[hyp].push(value); // if a value already exists, append to the rules array
    else rules[hyp] = [value]; // otherwise set
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

function shuffle(array) {
    /**
     * <p>Stole from Christoph on Stack Overflow:
     * {@link https://stackoverflow.com/a/962890}</p>
     */
    var tmp, current, top = array.length;

    if(top) while(--top) {
        current = Math.floor(Math.random() * (top + 1));
        tmp = array[current];
        array[current] = array[top];
        array[top] = tmp;
    }

    return array;
}

// Module export
export default AppRecom;
