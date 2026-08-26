// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {QuantumPitDonations} from "../src/QuantumPitDonations.sol";

/* ==========================================================================
   Deploy QuantumPitDonations.

   Reads everything from the environment — no keys in source:
     DEPLOYER_PRIVATE_KEY   the account that pays gas and signs the deploy
     TREASURY_ADDRESS       becomes the contract owner (can withdraw funds)

   Run against Base Sepolia FIRST (see contracts/README.md).
   ========================================================================== */

contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address treasury = vm.envAddress("TREASURY_ADDRESS");

        vm.startBroadcast(pk);
        QuantumPitDonations donations = new QuantumPitDonations(treasury);
        vm.stopBroadcast();

        console2.log("QuantumPitDonations deployed at:", address(donations));
        console2.log("Owner (treasury):", treasury);
        console2.log("Set DONATION_CONTRACT_ADDRESS to the address above.");
    }
}
