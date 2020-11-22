pragma solidity 0.5.12;

contract Ownable{

    address internal owner;

    modifier onlyOwner(){
        require(msg.sender == owner,"You are not the owner of this contract.");
        _;
    }

    constructor() public{
        owner = msg.sender;
    }

}
