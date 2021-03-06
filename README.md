# .ETH Registrar ENS

**This package is a work in progress. Breaking changes are likely to be made.**

### Todo:

-   Create `submitBid()` method to combine `shaBid()` and `newBid()`
    -   `shaBid()` and `newBid()` don't need to be exposed once that's done.
-   Add fast forwarding on TestRPC
-   Add more tests for getEntry to check bid and reveal status within the auction period
-   Create a bid object constructor to simplify bid management, the bid object contains at least
    -   name, hash, bid value, owner address, secret, and date submitted. Possibly also:
    -   reveal period start time, registration date. 
-   Possibly connect `submitBid()` to `openAuction()`, and run if the auction is not already open before submitting.
-   Anticipate and return errors for any inputs that would cause the contract to throw. 

<!-- To update docs below this point, run `$ documentation readme -f md -s "Overview"` from the root directory. -->

# Overview

<!-- Generated by documentation.js. Update this documentation by updating the source code. -->

## Registrar

Constructs a new Registrar instance, providing an easy-to-use interface to the
[Initial Registrar][wiki], which governs the `.eth` namespace.  Either Registrar.init(),
or registrar.initDefault() must be called

[wiki]: https://github.com/ethereum/ens/wiki

#### Example usage:

    var Registrar = require('eth-registrar-ens');
    var Web3 = require('web3');

    var web3 = new Web3();

The public ENS is already deployed on Ropsten at `0x112234455c3a32fd11230c42e7bccd4a84e02010`.
It will be at the same address when deployed on the Ethereum Main net. This package imports the
[`ethereum-ens`](https://www.npmjs.com/package/ethereum-ens) package, and defaults to the public ENS address,
so all that is needed to construct it is `[web3](https://www.npmjs.com/package/web3)`. The rest is optional.

    var registrar = new Registrar(web3);

If you are working with another instance of the ENS, you will need to instantiate your own
'ethereum-ens' object with the correct address. You can also specify a custom TLD, and minimum
character length for valid names.

    var ENS = require('ethereum-ens');
    var yourEnsAddress = '0x0dfc1...'
    var ens = new ENS(web3, address)
    var registrar = new Registrar(web3, ens, 'yourTLD', 0);

    var name = 'foobarbaz';
    registrar.startAuction(name);

    var owner = web3.eth.accounts[0]
    var value = web3.toWei(1, 'ether');

    // generate a sealed bid
    var bid = registrar.shaBid(name, owner, value, 'secret');

    // submit a bid, and a deposit value. The parameters of your true bid are secret.
    var deposit = web3.toWei(2, 'ether');
    registrar.newBid(bid, {value: deposit});

    // reveal your bid during the reveal period
    registrar.unsealBid(name, owner, value, 'secret');

    // After the registration date has passed, assign ownership of the name
    // in the ENS. In this case, the highest bidder would now own 'foobarbaz.eth'
    registrar.finalizeAuction(name);

Throughout this module, the same optionally-asynchronous pattern as web3 is
used: all functions that call web3 take a callback as an optional last
argument; if supplied, the function returns nothing, but instead calls the
callback with (err, result) when the operation completes.

Functions that create transactions also take an optional 'options' argument;
this has the same parameters as web3.

**Parameters**

-   `web3` **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** A web3 instance to use to communicate with the blockchain.
-   `address` **address** The address of the registrar.
-   `minLength` **integer?= 7** The minimum length of a name require by the registrar.
-   `tld` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)?= 'eth'** The top level domain
-   `ens` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)?= new ENS(web3)** The address of the ENS instance

**Meta**

-   **author**: J Maurelian
-   **license**: LGPL

### getEntry

Returns the properties of the entry for a given a name

**Parameters**

-   `input` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** The name or hash to get the entry for
-   `callback` **[function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** An optional callback; if specified, the
           function executes asynchronously.

Returns **any** An Entry object

### openAuction

Opens an auction for the desired name as well as several other randomly generated hashes,
this helps to prevent other bidders from guessing which names you are interested in.

**Parameters**

-   `name` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** The name to start an auction on
-   `params` **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)?= {}** An optional transaction object to pass to web3.
-   `callback` **[function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)?= null** An optional callback; if specified, the
           function executes asynchronously.

Returns **any** The txid, array of randomly generated names if callback is not supplied.

### bidFactory

Constructs a Bid object, with properties corresponding exactly to the
inputs of the registrar contracts 'shaBid' function.
When a bid is submitted, these values will be save so that they can be used
to reveal the bid params later.

**Parameters**

-   `name` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** The name to be bid on
-   `address` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** An optional owner address
-   `value` **[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** The value of your bid in wei
-   `secret` **secret** An optional random value
-   `owner`  

### submitBid

Submits a sealed bid and deposit to the registrar contract

**Parameters**

-   `bid` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
-   `params` **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)?= {}** An optional transaction object to pass to web3. The value sent must be
      at least as much as the bid value.
-   `callback` **[function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)?= null** An optional callback; if specified, the
           function executes asynchronously.
-   `bid` **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** A Bid object.

### unsealBid

Submits the parameters of a bid. The registrar will then generate
the bid string, and associate them with the previously submitted bid string and
deposit. If you have not already submitted a bid string, the registrar will throw.
If your bid is revealed as the current highest; the difference between your deposit
and bid value will be returned to you, and the previous highest bidder will have
their funds returned. If you are not the highest bidder, all your funds will be
returned. Returns are sent to the owner address on the bid.

**Parameters**

-   `name` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
-   `owner` **address** An optional owner address; defaults to sender
-   `value` **[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** The value of your bid
-   `secret` **secret** The secret used to create the bid string
-   `options` **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** An optional transaction object to pass to web3.
-   `callback` **[function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)?= null** An optional callback; if specified, the
           function executes asynchronously.
-   `params`   (optional, default `{}`)

Returns **any** The transaction ID if callback is not supplied.

### finalizeAuction

**Not yet implemented**
After the registration date has passed, calling finalizeAuction
will set the winner as the owner of the corresponding ENS subnode.

**Parameters**

-   `name` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
-   `options` **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** An optional transaction object to pass to web3.
-   `callback` **[function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)?= null** An optional callback; if specified, the
           function executes asynchronously.
-   `params`   (optional, default `{}`)

Returns **any** The transaction ID if callback is not supplied.

### transfer

**Not yet implemented**
The owner of a domain may transfer it, and the associated deed,
to someone else at any time.

**Parameters**

-   `name` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** The node to transfer
-   `newOwner` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** The address to transfer ownership to
-   `options` **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** An optional transaction object to pass to web3.
-   `callback` **[function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** An optional callback; if specified, the
           function executes asynchronously.

Returns **any** The transaction ID if callback is not supplied.

### releaseDeed

**Not yet implemented**
After one year, the owner can release the property and get their ether back

**Parameters**

-   `name` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** The name to release
-   `options` **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** An optional transaction object to pass to web3.
-   `callback` **[function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** An optional callback; if specified, the
           function executes asynchronously.

Returns **any** The transaction ID if callback is not supplied.

### invalidateName

**Not yet implemented**
Submit a name 6 characters long or less. If it has been registered,
the submitter will earn a portion of the deed value, and the name will be updated

**Parameters**

-   `name` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** An invalid name to search for in the registry.
-   `options` **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** An optional transaction object to pass to web3.
-   `callback` **[function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** An optional callback; if specified, the
           function executes asynchronously.

Returns **any** The transaction ID if callback is not supplied.

### transferRegistrars

**Not yet implemented**
Transfers the deed to the current registrar, if different from this one.
Used during the upgrade process to a permanent registrar.

**Parameters**

-   `name`  The name to transfer.
-   `options` **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** An optional transaction object to pass to web3.
-   `callback` **[function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** An optional callback; if specified, the
           function executes asynchronously.

Returns **any** The transaction ID if callback is not supplied.

## cleanName

Maps special characters to a similar "canonical" character.
We are being much more stringent than nameprep for now.

**Parameters**

-   `input`  

## Entry

Constructs a new Entry instance corresponding to a name.

**Parameters**

-   `name` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** The unhashed name
-   `hash` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
-   `status` **[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** 
-   `deed` **address** 
-   `registrationDate` **[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** 
-   `value` **[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** 
-   `highestBid` **[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** 

## Deed

Constructs a Deed object

**Parameters**

-   `address`  
-   `balance`  
-   `creationDate`  
-   `owner`  
