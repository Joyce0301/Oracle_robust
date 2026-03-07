// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

// This is a sample contract. You can use it as a starting point for your own contracts.
contract Lock {
    uint public unlockTime;
    address payable public owner;

    event Withdrawal(uint amount, uint when);

    constructor(uint _unlockTime) payable {
        require(
            block.timestamp < _unlockTime,
            "Unlock time should be in the future"
        );

        unlockTime = _unlockTime;
        owner = payable(msg.sender);
    }

    function withdraw() public {
        // Check if the unlock time has passed
        require(block.timestamp >= unlockTime, "You can't withdraw yet");

        // Check if the caller is the owner
        require(msg.sender == owner, "You aren't the owner");

        // Emit an event
        emit Withdrawal(address(this).balance, block.timestamp);

        // Transfer the balance to the owner
        owner.transfer(address(this).balance);
    }
}
