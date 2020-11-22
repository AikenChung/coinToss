var web3 = new Web3(Web3.givenProvider);
var contractInstance;

$(document).ready(function() {
    window.ethereum.enable().then(function(accounts){
      contractInstance = new web3.eth.Contract(window.abi,"contract address", {from: accounts[0]});
      console.log(contractInstance);
      var userBet_queryId;
      // catch event of request to Oracle
      var eventBetCreatedAndWait= contractInstance.events.betCreatedAndWait(function(err, result){
        if (err){
          console.log(err);
        }
        else {
          console.log(result);
          userBet_queryId=result.returnValues[2];
          console.log(userBet_queryId);
        }
      });
      // catch event of feedback from Oracle
      var eventOracleReplyBack=contractInstance.events
      .oracleReplyBack({filter: {queryID: userBet_queryId}
      }, function(err, result){
        if (err){
          console.log(err);
        }
        else{
          console.log(result);
          fetchAndDisplay(userBet_queryId);
        }
      });
      // updating current balance INfo in the contract
      fetchBalanceInfo();
    });
    $("#make_a_bet_button").click(function(){
       fetchBalanceInfo();
       removeBetResultContent();
       inputData();
       coinTossImgShow();
    });
    $("#withdrawAll_button").click(withdrawAllContractChecking);
    $("#add_balance_button").click(ownerAddContractBalance);
    $("#update_balanceInfo_button").click(fetchBalanceInfo);
});

// Collecting betting data at fron-end and invoke createBet() in the contract
//  function chekcUserIsWaiting() also be invoked here.
function inputData(){
  var name = $("#name_input").val();
  var amount = $("#amount_input").val(); // uint is in Ether
  userBet = checkUserSelectRadioButton();
  // check if all input data is valid
  if(userBet<0){
    alert("Please select the coin side of your bet!");
    return
  } else if (name == "") {
    alert("Please enter your name!");
    return
  } else if (amount == "") {
    alert("Please enter the amount you want to bet!");
    return
  }
  // Checking if the contract has enough money`
  var amountToCheck = Number($("#contractBalance_output").text()) - amount;
  if(amountToCheck > 0){
    console.log("The contract has enough money for this bet.");
  }else{
    console.log("The contract does not have enough money for this bet.");
    alert("The contract does not has enough money for this bet!");
    return
  }
  // Checking if the user is waiting for a betting result.
  chekcUserIsWaiting();
  var selectedCoinSide = checkUserSelectRadioButton();
  var config = {
    value: web3.utils.toWei(String(amount), "ether")
  };
  contractInstance.methods.createBet(name, selectedCoinSide).send(config)
  .on('transactionHash', function(hash){
    console.log("tx hash");
  })
  .on('confirmation', function(confirmationNumber, receipt){
      console.log("conf");
  })
  .on('receipt', function(receipt){
    console.log(receipt);
  });
  // updating current balance INfo in the contract
  fetchBalanceInfo();
}
// Get betting result from the contract and display at the front-end
function fetchAndDisplay(betQueryId){
  //contractInstance.methods.checkUserWinOrLose(userQueryId,userQueryRandNum).send();
  contractInstance.methods.getBetInfo(betQueryId).call().then(function(res){
    displayInfo(res);
  });
  // Remove the info in the betting area
  $("#name_input").val("");
  $("#amount_input").val("");
}
// Display the betting result at the front-end
function displayInfo(res){
  tossCoinResultShow(res["winOrLose"], res["selectedCoinSide"]);
  $("#queryId_output").text(res["ref_queryId"]);
  $("#name_output").text(res["name"]);
  if(res["selectedCoinSide"] === "0"){
    $("#coinside_output").text("head");
  }else{
    $("#coinside_output").text("tail");
  }
  if(res["ref_randomNumber"] > 0){
    $("#flipResult_output").text("You got a tail.");
  }else{
    $("#flipResult_output").text("You got a head.");
  }
  if(res["winOrLose"]){
    $("#betResult_output").text("Yes. You win!");
  }else{
    $("#betResult_output").text("No. You lose!");
  }
  var amountToBetInWei = res["amountToBet"];
  var amountToBetInEther = amountToBetInWei/1000000000000000000;
  $("#amount_output").text(amountToBetInEther +" ether");

  // updating current balance INfo in the contract
  fetchBalanceInfo();
}

// Displaying the action image of tossing a coin
function coinTossImgShow(){
  var coinFlipImage = "images/coinToss.jpeg";
  var coinFlipImage_action = document.querySelectorAll("img")[2];
  coinFlipImage_action.setAttribute("src",coinFlipImage);
  var userWin = document.querySelector("h2.coin_flip_result").innerHTML = "... tossing ...";
  //window.setTimeout(() => { tossCoinResultShow(bettingResult, coinsideToPass); }, 3000);
}

// Display betting result at the frond-end
function tossCoinResultShow(betResult, selectedCoinsideToPass){

  //For selecting a side of the coin
  var coinTossResultImage = "images/coinToss.jpeg";
  if(betResult) {
    if(selectedCoinsideToPass == 0){
        coinTossResultImage = "images/coin_head_cat.jpeg";
        $("#coin_flip_result_msg").text("Coin flip result: head");
        $("#user_bet_msg").text("Your bet: head-> Win");
    }else{
        coinTossResultImage = "images/coin_tail_cat.jpeg";
        $("#coin_flip_result_msg").text("Coin flip result: tail");
        $("#user_bet_msg").text("Your bet: tail-> Win");
    }
  }else{
    if(selectedCoinsideToPass == 0){
        coinTossResultImage = "images/coin_tail_cat.jpeg";
        $("#coin_flip_result_msg").text("Coin flip result: tail");
        $("#user_bet_msg").text("Your bet: head-> Lose");
    }else{
        coinTossResultImage = "images/coin_head_cat.jpeg";
        $("#coin_flip_result_msg").text("Coin flip result: head");
        $("#user_bet_msg").text("Your bet: tail-> Lose");
    }
  }
  //====================================================

  // Display the final image of the betting result
  var coinTossResultImage_show = document.querySelectorAll("img")[2];
  coinTossResultImage_show.setAttribute("src",coinTossResultImage);
}

// Check if this withdraw is invoked by the contract owner.
function withdrawAllContractChecking(){
  contractInstance.methods.checkOwner().call().then(function(res){
    withdrawAllContract(res);
  });
}

// Contract owner can withdraw all the money in the contract
function withdrawAllContract(res){
  if(res){
    contractInstance.methods.withdrawAll().send()
    .on('transactionHash', function(hash){
        console.log("Contract Balance withdrawn!!");
        console.log(hash);
    });
  }else{
    alert("Only owner can withdraw money from contract!");
    return;
  }
}

// IF the contract does not have enough money, owner can add more in it.
function ownerAddContractBalance(){
  var amount = $("#user_add_amount_input").val();
  if (amount == "") {
    alert("Please enter the amount you want to add into the contract!");
    return;
  }
  var config = {
    value: web3.utils.toWei(String(amount), "ether")
  };
  contractInstance.methods.onlyOwnerAddBalance().send(config);
  $("#user_add_amount_input").val("");
}

// Once a bet created, removing all the betting result of last one
function removeBetResultContent(){
  $("#queryId_output").text("");
  $("#name_output").text("");
  $("#coinside_output").text("");
  $("#amount_output").text("");
  $("#flipResult_output").text("");
  $("#betResult_output").text("");
}

// If a user is waiting for a betting result, then then return
function chekcUserIsWaiting(){
  contractInstance.methods.isWaiting().call().then(function(res){
    actionIfUserIsWaiting(res);
  });
}

function actionIfUserIsWaiting(res){
  if(res){
    console.log("User is in the waiting quene.");
    return
  }else{
    console.log("User is not in the waiting quene.");
  }
}

// check which radio button user has selected
function checkUserSelectRadioButton(){
  var userBet = -1;
  var radioButtons = document.getElementsByName("radio_group");
  for (var i = 0; i < radioButtons.length; i++) {
      if (radioButtons[i].checked == true) {
          var userSelected = radioButtons[i].value;
          if (userSelected === "head") {
              userBet = 0;
          } else {
              userBet = 1;
          }
          break;
      }
  }
  return userBet;
}
// Fetching the balance info in the contract
function fetchBalanceInfo(){
  contractInstance.methods.getContractBalanceInfo().call().then(function(res){
    displayBalanceInfo(res);
  });
}

// Display the betting result at the front-end
function displayBalanceInfo(res){
  var amountContractBalance = res["currUsableBalance"];
  var amountContractBalanceInEther = amountContractBalance/1000000000000000000;
  $("#contractBalance_output").text(amountContractBalanceInEther);
  var amountCurrUserBetPoolBalance = res["currUserBetPoolBalance"];
  var amountCurrUserBetPoolBalanceInEther = amountCurrUserBetPoolBalance/1000000000000000000;
  $("#bettingPoolBalance_output").text(amountCurrUserBetPoolBalanceInEther);
}
// Check if there is monry in the betting pool
// If there is , meaning there is un-finished betting, so cannot withdraw
function isWithdrawable(){
  var poolBalance = $("#bettingPoolBalance_output").val();
}
