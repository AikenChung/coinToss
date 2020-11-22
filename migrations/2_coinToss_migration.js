const coinToss = artifacts.require("coinToss");

module.exports = function(deployer, network, accounts) {
  deployer.deploy(coinToss).then(function(instance){
    instance.onlyOwnerAddBalance({value: 100000000000000000, from: accounts[0]}).then(function(){
        console.log("Contract Successfully deployed!");
      }).catch(function(err){
        console.log("error: " + err);
      });
  }).catch(function(err){
    console.log("Deploy failed " + err);
  });
};
