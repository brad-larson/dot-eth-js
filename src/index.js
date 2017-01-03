const interfaces = require('./interfaces.js');

const ENS = require('ethereum-ens');
const StringPrep = require('node-stringprep').StringPrep;

const NamePrep = new StringPrep('nameprep');
const _ = require('underscore');

const namehash = ENS.prototype.namehash;



/**
 * Constructs a new Registrar instance, providing an easy-to-use interface to the
 * [Initial Registrar][wiki], which governs the `.eth` namespace.  Either Registrar.init(),
 * or registrar.initDefault() must be called
 * [wiki]: https://github.com/ethereum/ens/wiki
 *
 * Example usage:
 *
 *     var Registrar = require('eth-registrar-ens');
 *     var Web3 = require('web3');
 *
 *     var web3 = new Web3();
 *     var registrar = new Registrar(web3)
 *
 *     // On Ropsten with the public ENS registry
 *     registrar.init();
 *     console.log(registrar.ens.registry.address);
 *     // '0x112234455c3a32fd11230c42e7bccd4a84e02010'
 *     console.log(registrar.rootNode);
 *     // '0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae'
 *
 *     var name = 'foobarbaz';
 *     registrar.startAuction(name);
 *
 *     var owner = web3.eth.accounts[0]
 *     var value = web3.toWei(1, 'ether');
 *
 *     // generate a sealed bid
 *     var bid = registrar.shaBid(name, owner, value, 'secret');
 *
 *     // submit a bid, and a deposit value. The parameters of your true bid are secret.
 *     var deposit = web3.toWei(2, 'ether');
 *     registrar.newBid(bid, {value: deposit});
 *
 *     // reveal your bid during the reveal period
 *     registrar.unsealBid(name, owner, value, 'secret');
 *
 *     // After the registration date has passed, assign ownership of the name
 *     // in the ENS. In this case, the highest bidder would now own 'foobarbaz.eth'
 *     registrar.finalizeAuction(name);
 *
 *
 *
 *
 *
 * Throughout this module, the same optionally-asynchronous pattern as web3 is
 * used: all functions that call web3 take a callback as an optional last
 * argument; if supplied, the function returns nothing, but instead calls the
 * callback with (err, result) when the operation completes.
 *
 * Functions that create transactions also take an optional 'options' argument;
 * this has the same parameters as web3.
 *
 * @author J Maurelian
 * @date 2016
 * @license LGPL
 *
 * @class
 * @param {object} web3 A web3 instance to use to communicate with the blockchain.
 * @param {address} address The address of the registrar.
 * @param {integer} minLength The minimum length of a name require by the registrar.
 * @param {string} tld The top level domain
 * @param {string} ens The address of the ENS instance
 */
function Registrar(web3) {
  this.web3 = web3;

  // Fix web3 < 0.16 breaking change (leading 0x)
  this.sha3 = function sha3withZeroX(...args) {
    const result = web3.sha3.apply(this, args);
    if (result[1] !== 'x') {
      return `0x${result}`;
    }
    return result;
  };
}

// const publicRegistryAddress = '0x112234455c3a32fd11230c42e7bccd4a84e02010';

Registrar.prototype.init = function init(ens, tld, minLength) {
  // get registrar address from ens
  this.ens = ens || new ENS(this.web3);
  this.tld = tld || 'eth';
  this.minLength = minLength || 7;
  this.address = this.ens.owner(this.tld);
  this.contract = this.web3.eth.contract(interfaces.registrarInterface).at(this.address);
  // this isn't used yet, but I expect it will be handy
  this.rootNode = namehash(this.tld);
};

Registrar.TooShort = Error('Name is too short');

/**
 * Maps special characters to a similar "canonical" character.
 * We are being much more stringent than nameprep for now.
*/
function cleanName(input) {
  return NamePrep.prepare(input)
    .replace(/[áăǎâäȧạȁàảȃāąᶏẚåḁⱥã]/g, 'a')
    .replace(/[èéêëēěĕȅȩḙėẹẻęẽ]/g, 'e')
    .replace(/[íĭǐîïịȉìỉȋīįᶖɨĩḭ]/g, 'i')
    .replace(/[óŏǒôöȯọőȍòỏơȏꝋꝍⱺōǫøõ]/g, 'o')
    .replace(/[úŭǔûṷüṳụűȕùủưȗūųᶙůũṵ]/g, 'u')
    .replace(/[çćčĉċ]/g, 'c')
    .replace(/[śšşŝșṡṣʂᵴꞩᶊȿ]/g, 's')
    .replace(/[^a-z0-9\-_]*/g, '');
}

Registrar.SpecialCharacters = Error(
    'Name cannot contain special characters other than ' +
    'a-z, 0-9, \'-\' and \'_\'.'
);

Registrar.prototype.validateName = function validateName(name) {
  if (name.length <= this.minLength) {
    throw Registrar.TooShort;
  }
  if (name !== cleanName(name)) {
    throw Registrar.SpecialCharacters;
  }
};


/**
 * Constructs a new Entry instance corresponding to a name.
 *
 * @param {string} name The unhashed name
 * @param {string} hash
 * @param {number} status
 * @param {address} deed
 * @param {number} registrationDate
 * @param {number} value
 * @param {number} highestBid
 */
function Entry(name, hash, status, deed, registrationDate, value, highestBid) {
  // TODO: improve Entry constructor so that unknown names can be handled via getEntry
  this.name = name;
  this.hash = hash;
  this.status = status;
  this.deed = deed;
  this.registrationDate = registrationDate;
  this.value = value;
  this.highestBid = highestBid;

  // Check the auction mode

  let mode = '';

  // TODO: make the minimum length dynamic to match the Registrar constructor
  if (name.length < 7) {
    // If name is short, check if it has been bought
    if (this.status === 0) {
      // TODO: Calling this 'invalid' is confusing, it's not the same as 'invalidated'
      mode = 'invalid';
    } else {
      mode = 'can-invalidate';
    }
  } else {
    // If name is of valid length
    if (this.status === 0) { //eslint-disable-line
      // Not an auction yet
      mode = 'open';
    } else if (this.status === 1) {
      const now = new Date();
      const registration = new Date(this.registrationDate * 1000);
      const hours = 60 * 60 * 1000;

      if ((registration - now) > 24 * hours) {
        // Bids are open
        mode = 'auction';
      } else if (now < registration && (registration - now) < 24 * hours) {
        // reveal time!
        mode = 'reveal';
      } else if (now > registration && (now - registration) < 24 * hours) {
        // finalize now
        mode = 'finalize';
      } else {
        // finalize now but can open?
        mode = 'finalize-open';
      }
    } else if (this.status === 2) {
      mode = 'owned';
    }
  }

  this.mode = mode;
}


/**
 * Constructs a Deed object
 */
function Deed(address, balance, creationDate, owner) {
  this.address = address;
  this.balance = balance;
  this.creationDate = creationDate;
  this.owner = owner;
}


Registrar.prototype.getDeed = function getDeed(address) {
  const d = this.web3.eth.contract(interfaces.deedInterface).at(address);
  const balance = this.web3.eth.getBalance(address);
  return new Deed(d.address, balance, d.creationDate(), d.owner());
};


/**
 * Returns the properties of the entry for a given a name
 *
 * @method getEntry
 * @alias Registrar.getEntry
 * @memberOf Registrar.prototype
 * @param {string} input The name or hash to get the entry for
 * @param {function} callback An optional callback; if specified, the
 *        function executes asynchronously.
 *
 * @returns An Entry object
 */
Registrar.prototype.getEntry = function getEntry(input, callback) {
  // Accept either a name or a hash
  let hash = input;
  // if the input is a hash, we'll use that for the name in the entry object
  let name = input;
  // if the input is a name
  if (input.substring(0, 2) !== '0x') {
    name = cleanName(input);
    hash = this.sha3(name);
  }

  const e = this.contract.entries(hash);
  let deed;

  if (e[1] !== '0x0000000000000000000000000000000000000000') {
    //
    deed = this.getDeed(e[1]);
  } else {
    // construct a deed object with all props null except for the 0 address
    deed = new Deed(e[1], null, null, null);
  }

  const entry = new Entry(
    name,
    hash,
    e[0].toNumber(),
    deed,
    e[2].toNumber(),
    e[3].toNumber(),
    e[4].toNumber()
  );

  if (callback) {
    callback(null, entry);
  } else {
    return entry;
  }
};

/**
 * ## Start Auction
 *
 * Converts a name to a hash string, and opens an auction on that hash.
 *
 * @param {string} name The name to start an auction on
 * @param {object} params An optional transaction object to pass to web3.
 * @param {function} callback An optional callback; if specified, the
 *        function executes asynchronously.
 *
 * @returns The txid if callback is not supplied.
 */
Registrar.prototype.startAuction = function startAuction(name, params = {}, callback = null) {
  const hash = this.sha3(name);

  if (callback) {
    try {
      this.validateName(name);
      // if name is not valid, this line won't be called.
      this.contract.startAuction(hash, params, callback);
    } catch (e) {
      callback(e, null);
    }
  } else {
    this.validateName(name);
    return this.contract.startAuction(hash, params);
  }
};

/**
 * ## Start Auctions (plural)
 *
 *
 * Opens auctions for multiple names at once. Since names are registered as hashes,
 * this helps to prevent other bidders from guessing which names you are interested in.
 *
 * @param {array} names An array of names to start auctions on
 * @param {object} params An optional transaction object to pass to web3.
 * @param {function} callback An optional callback; if specified, the
 *        function executes asynchronously.
 *
 * @returns The txid if callback is not supplied.
 */
Registrar.prototype.startAuctions = function startAuctions(names, params = {}, callback = null) {
  const hashes = _.map(names, this.sha3);
  const invalidNames = names.filter(
    function isLongEnough(name) { return name.length < this.minLength; },
    this
  );

  if (callback) {
    if (invalidNames.length > 0) {
      callback(Registrar.TooShort, null);
    } else {
      this.contract.startAuctions(hashes, params, callback);
    }
  } else {
    if (invalidNames.length > 0) {
      throw Registrar.TooShort;
    }
    return this.contract.startAuctions(hashes, params);
  }
};

/**
 * ## Open Auctions
 *
 * Opens an auction for the desired name as well as several other randomly generated hashes,
 * this helps to prevent other bidders from guessing which names you are interested in.
 *
 * @param {string} name The name to start an auction on
 * @param {object} params An optional transaction object to pass to web3.
 * @param {function} callback An optional callback; if specified, the
 *        function executes asynchronously.
 *
 * @returns The txid, array of randomly generated names if callback is not supplied.
 */
Registrar.prototype.openAuction = function openAuction(name, params = {}, callback = null) {
  const hash = this.sha3(name);

  // Generate an array of random hashes
  const randomHashes = new Array(10);
  for (let i = 0; i < randomHashes.length; i++) {
    randomHashes[i] = this.sha3(Math.random().toString());
  }
  // Randomly select an array entry to replace with the name we want
  const j = Math.floor(Math.random() * 10);
  randomHashes[j] = hash;

  if (callback) {
    try {
      this.validateName(name);
      // if name is not valid, this line won't be called.
      this.contract.startAuctions(randomHashes, params, callback);
    } catch (e) {
      callback(e, null);
    }
  } else {
    this.validateName(name);
    return this.contract.startAuctions(randomHashes, params);
  }
};


/**
 * Generates the "bid string" (hash) which representing a sealed bid. This does not
 * submit the bid to the registrar, it only calls on the registrar's corresponding
 * method.
 *
 * ToDo: Make `owner` default to sender if not specified.
 *
 * @param {string} name The name to be bid on
 * @param {string} address An optional owner address
 * @param {number} value The value of your bid in wei
 * @param {secret} secret An optional random value
 *
 * @returns the sealed bid hash string
 */
// How should we better handle secret generation and storage?
// it could be abstracted away and handle generation, storage agnd retrieval.
Registrar.prototype.shaBid = function shaBid(name, owner, value, secret, callback = null) {
  const clean = cleanName(name);
  const hash = this.sha3(clean);
  const hexSecret = this.sha3(secret);

  if (callback) {
    this.contract.shaBid(hash, owner, value, hexSecret, callback);
  } else {
    return this.contract.shaBid(hash, owner, value, hexSecret);
  }
};

Registrar.NoDeposit = Error('You must specify a deposit amount greater than the value of your bid');

/**
 * Submits a bid string to the registrar, creating a new sealed bid entry.
 * The value
 *
 * @param {string} bid
 * @param {object} params A dict of parameters to pass to web3. An amount must be included.
 * @param {function} callback An optional callback; if specified, the
 *        function executes asynchronously.
 *
 * @returns The transaction ID if callback is not supplied.
 */
/* At present this provides very little utility, aside from
 putting the method where you would expect it to be.
 * More value would be in:
    * creating the bid hash string
    * accepting the value as a "deposit" variable
    * accepting a bid object:
    {
        name: "name",
        owner: "0xaddress",
        value: 1,
        deposit: 2,
        secret: "secret"
    }
*/
Registrar.prototype.newBid = function newBid(bid, params = {}, callback = null) {
  // Unlike the previous methods, params are necessary here in order to make the deposit
  if (callback) {
    if (!params.value) {
      callback(Registrar.NoDeposit, null);
    } else {
      this.contract.newBid(bid, params, callback);
    }
  } else {
    if (!params.value) {
      throw Registrar.NoDeposit;
    }
    return this.contract.newBid(bid, params);
  }
};

/**
 * Submits the parameters of a bid. The registrar will then generate
 * the bid string, and associate them with the previously submitted bid string and
 * deposit. If you have not already submitted a bid string, the registrar will throw.
 * If your bid is revealed as the current highest; the difference between your deposit
 * and bid value will be returned to you, and the previous highest bidder will have
 * their funds returned. If you are not the highest bidder, all your funds will be
 * returned. Returns are sent to the owner address on the bid.
 *
 * @param {string} name
 * @param {address} owner An optional owner address; defaults to sender
 * @param {number} value The value of your bid
 * @param {secret} secret The secret used to create the bid string
 * @param {object} options An optional transaction object to pass to web3.
 * @param {function} callback An optional callback; if specified, the
 *        function executes asynchronously.
 *
 * @returns The transaction ID if callback is not supplied.
 */
Registrar.prototype.unsealBid = function
  unsealBid(name, owner, value, secret, params = {}, callback = null) {
  const clean = cleanName(name);
  const hash = this.sha3(clean);
  const hexSecret = this.sha3(secret);

  if (callback) {
    this.contract.unsealBid(hash, owner, value, hexSecret, params, callback);
  } else {
    return this.contract.unsealBid(hash, owner, value, hexSecret, params);
  }
};


/**
 * __Not yet implemented__
 * After the registration date has passed, calling finalizeAuction
 * will set the winner as the owner of the corresponding ENS subnode.
 *
 * @param {string} name
 * @param {object} options An optional transaction object to pass to web3.
 * @param {function} callback An optional callback; if specified, the
 *        function executes asynchronously.
 *
 * @returns The transaction ID if callback is not supplied.
 */
Registrar.prototype.finalizeAuction = function finalizeAuction(name, params = {}, callback = null) {
  const clean = cleanName(name);
  const hash = this.sha3(clean);

  if (callback) {
    this.contract.startAuction(hash, params, callback);
  } else {
    return this.contract.startAuction(hash, params);
  }
};

/**
 * __Not yet implemented__
 * The owner of a domain may transfer it, and the associated deed,
 * to someone else at any time.
 *
 * @param {string} name The node to transfer
 * @param {string} newOwner The address to transfer ownership to
 * @param {object} options An optional transaction object to pass to web3.
 * @param {function} callback An optional callback; if specified, the
 *        function executes asynchronously.
 *
 * @returns The transaction ID if callback is not supplied.
 */
Registrar.prototype.transfer = function transfer() {
};

/**
 * __Not yet implemented__
 * After one year, the owner can release the property and get their ether back
 *
 * @param {string} name The name to release
 * @param {object} options An optional transaction object to pass to web3.
 * @param {function} callback An optional callback; if specified, the
 *        function executes asynchronously.
 *
 * @returns The transaction ID if callback is not supplied.
 */
Registrar.prototype.releaseDeed = function releaseDeed() {

};

/**
 * __Not yet implemented__
 * Submit a name 6 characters long or less. If it has been registered,
 * the submitter will earn a portion of the deed value, and the name will be updated
 *
 * @param {string} name An invalid name to search for in the registry.
 * @param {object} options An optional transaction object to pass to web3.
 * @param {function} callback An optional callback; if specified, the
 *        function executes asynchronously.
 *
 * @returns The transaction ID if callback is not supplied.
 */
Registrar.prototype.invalidateName = function invalidateName() {

};


/**
 * __Not yet implemented__
 * Transfers the deed to the current registrar, if different from this one.
 * Used during the upgrade process to a permanent registrar.
 *
 * @param name The name to transfer.
 * @param {object} options An optional transaction object to pass to web3.
 * @param {function} callback An optional callback; if specified, the
 *        function executes asynchronously.
 *
 * @returns The transaction ID if callback is not supplied.
 */
Registrar.prototype.transferRegistrars = function transferRegistrars() {

};

module.exports = Registrar;