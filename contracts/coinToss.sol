pragma solidity 0.5.12;
import "./Ownable.sol";
import "./provableAPI.sol";
//import "github.com/provable-things/ethereum-api/provableAPI.sol";

contract coinToss is Ownable, usingProvable{

  struct Person {
      string name;
      uint selectedCoinSide;
      uint amountToBet;
      bytes32[] bet_queryId;
  }

  struct BetInfo{
    string name;
    uint selectedCoinSide;
    uint amountToBet;
    uint ref_randomNumber;
    bool winOrLose; // true for wining.
    address userAddress;
  }

  uint256 constant NUM_RANDOM_BYTES_REQUESTED = 1;
  uint public usableBalance; // usable balance in the contract
  uint public userBetPoolBalance; // balance from the user

  // For storing current status of an user and will keep updating every time
  mapping(address => Person) private participant;
  // For tracking whether a user is waiting for betting result, if ture, then the user cannot make a new bet
  mapping(address => bool) private  address_waiting_Map;
  // For preserving all of related information of a bet
  mapping (bytes32 => BetInfo) private queryId_BetInfo_Map ;

  event LogNewProvableQuery(string description);
  event betCreatedAndWait(string action_description, string name, bytes32 ref_queryId);
  event oracleReplyBack(bytes32 _queryId, uint256 randomNumber, address userAddress, bool userWinOrLose);
  event eventCheckContractBalance(string contract_balanceChecking, uint256 contractBalance, uint256 contractUserBalance);
  event eventCheckContractBalanceIfUserWin(string contract_balanceChecking, uint256 contractBalance, uint256 contractUserBalance);


  // Oracle code
  //===========================================================================
  function __callback(bytes32 _queryId, string memory _result, bytes memory _proof) public {
    require(msg.sender == provable_cbAddress()); // This can only be used by Oracle
    uint256 randomNumber = uint256(keccak256(abi.encodePacked(_result))) % 2;
    queryId_BetInfo_Map[_queryId].ref_randomNumber = randomNumber;
    checkUserWinOrLose( _queryId, randomNumber);
    address_waiting_Map[queryId_BetInfo_Map[_queryId].userAddress] = false;
    emit oracleReplyBack(_queryId, queryId_BetInfo_Map[_queryId].ref_randomNumber, queryId_BetInfo_Map[_queryId].userAddress, queryId_BetInfo_Map[_queryId].winOrLose);
  }
  // Actual function to create random number from Oracle
  function getRandomNumOracle(address userPlaceBet) payable public returns (bytes32){
    uint256 QUERY_EXECUTION_DELAY = 0;
    uint256 GAS_FOR_CALLBACK = 200000;
    bytes32 queryId = provable_newRandomDSQuery(
      QUERY_EXECUTION_DELAY,
      NUM_RANDOM_BYTES_REQUESTED,
      GAS_FOR_CALLBACK
    );
    participant[userPlaceBet].bet_queryId.push(queryId);
    BetInfo memory newBet;
    newBet.name = participant[userPlaceBet].name;
    newBet.selectedCoinSide = participant[userPlaceBet].selectedCoinSide;
    newBet.amountToBet = participant[userPlaceBet].amountToBet;
    newBet.userAddress = userPlaceBet;
    // Insert a new bet information with a queryId as the key
    queryId_BetInfo_Map[queryId] = newBet;
    emit LogNewProvableQuery("Provable query was sent, waiting for the answer from the Oracle....");
    return queryId;
  }
  //============================================================================


  // function to create a bet, invoked by "make_a_bet_button"
  function createBet(string memory name, uint selectedCoinSide) public payable {
      uint current_msg_value = msg.value;
      address current_msg_sender = msg.sender;
      require(address_waiting_Map[current_msg_sender] == false, "You are waitting for your bet result...cannot make a bet now!");
      address_waiting_Map[current_msg_sender] = true;
      userBetPoolBalance += current_msg_value;
      usableBalance = address(this).balance - userBetPoolBalance*2;
      Person memory newPerson;
      newPerson.name = name;
      newPerson.selectedCoinSide = selectedCoinSide;
      newPerson.amountToBet = current_msg_value;
      insertPerson(current_msg_sender, newPerson);
      bytes32 queryIdForRandomNum = getRandomNumOracle(current_msg_sender);
      emit betCreatedAndWait("Bet produced, waiting for Oracle result...", name, queryIdForRandomNum);
      emit eventCheckContractBalance("Checking balance in the contract after making a bet: ", usableBalance, userBetPoolBalance);
  }

  // Adding user info into a mapping data structure
  function insertPerson(address addrssKey, Person memory newPerson) private{
      participant[addrssKey] = newPerson;
  }

  // Contract owner adds money to the  contract
  function onlyOwnerAddBalance() public payable onlyOwner{
      usableBalance = address(this).balance - userBetPoolBalance*2;
  }

  // Passing the result of a betting, invoked by fetchAndDisplay() function at front-end
  function getBetInfo(bytes32 userBet_queryId) public view returns(bytes32 ref_queryId, string memory name, uint selectedCoinSide, uint amountToBet, uint ref_randomNumber, bool winOrLose){
      string memory name_result = queryId_BetInfo_Map[userBet_queryId].name;
      uint selectedCoinSide_result = queryId_BetInfo_Map[userBet_queryId].selectedCoinSide;
      uint amountToBet_result = queryId_BetInfo_Map[userBet_queryId].amountToBet;
      uint ref_randomNumber_result = queryId_BetInfo_Map[userBet_queryId].ref_randomNumber;
      bool winOrLose_result = queryId_BetInfo_Map[userBet_queryId].winOrLose;

      return (userBet_queryId, name_result, selectedCoinSide_result, amountToBet_result, ref_randomNumber_result, winOrLose_result);
  }

  // Withdraw all the money in the contract, invoked only by the Contract owner
  bool private withdrawLock = false;
  function withdrawAll() public onlyOwner {
      require(!withdrawLock, "Reentrant withdrawAll call detected!");
      withdrawLock = true;
      uint toTransfer = address(this).balance;
      usableBalance = 0;
      userBetPoolBalance = 0;
      (bool success, ) = msg.sender.call.value(toTransfer)("");
      require(success, "WithdrawAll Transfer failed.");
      withdrawLock = false;
  }

  // When a user wins, this function will be invoked!!
  bool private userWithdrawLock = false;
  function userWithdraw(address payable currentUserAddress, uint userBetAmount) public payable returns(uint){
      require(!userWithdrawLock, "Reentrant userWithdraw call detected!");
      userWithdrawLock = true;
      uint toTransfer = userBetAmount*2;
      userBetPoolBalance = userBetPoolBalance - userBetAmount;
      (bool success, ) = currentUserAddress.call.value(toTransfer)("");
      require(success, "User Withdraw Transfer failed.");
      emit eventCheckContractBalanceIfUserWin("Checking balance in the contract after a user wins: ", usableBalance, userBetPoolBalance);
      usableBalance = address(this).balance - userBetPoolBalance*2;
      userWithdrawLock = false;
      return toTransfer;
  }

  // update betting result after getting events emitted back from Oracle
  bool private checkUserWinOrLoseLock = false;
  function checkUserWinOrLose(bytes32 user_queryId, uint userRandonNum) public{
    require(!checkUserWinOrLoseLock, "Reentrant checkUserWinOrLose call detected!");
    checkUserWinOrLoseLock = true;
    address payable user_Address = address(uint160(queryId_BetInfo_Map[user_queryId].userAddress));
    uint userAmountToBet = queryId_BetInfo_Map[user_queryId].amountToBet;
    bool betResult = false; // true for win, false for lose
    if(queryId_BetInfo_Map[user_queryId].selectedCoinSide == userRandonNum){
      betResult = true;
      userWithdraw(user_Address, userAmountToBet);
    }else{
      betResult = false;
      usableBalance = usableBalance + userAmountToBet;
      userBetPoolBalance = userBetPoolBalance - userAmountToBet;
    }
    queryId_BetInfo_Map[user_queryId].winOrLose = betResult;
    checkUserWinOrLoseLock = false;
  }

  // function for checking if you are the contract owner at front-end
  function checkOwner() public view returns(bool){
    if(msg.sender == owner){
      return true;
    }else{
      return false;
    }
  }

  // Checking if a user is in the middle of a bet and waiting...
  function isWaiting() public view returns(bool){
    return address_waiting_Map[msg.sender];
  }

  // For accessing currently usable contract balance
  function getContractBalanceInfo() public returns(uint currUsableBalance, uint currUserBetPoolBalance){
    usableBalance = address(this).balance - userBetPoolBalance*2;
    return (usableBalance, userBetPoolBalance);
  }

} // end of Contract Class
