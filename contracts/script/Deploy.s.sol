// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {QuantumPitDonations} from "../src/QuantumPitDonations.sol";
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
