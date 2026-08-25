// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Script, console } from "forge-std/Script.sol";
import { CPIAdapterGovernance } from "../src/CPIAdapterGovernance.sol";
import { CPIReportAdapter } from "../src/CPIReportAdapter.sol";

/// @notice Prints a decodeable DAO proposal for transferring CPI reporting to the adapter.
/// @dev This script never broadcasts. Review the source policy and output before submitting the
/// returned targets, values, and calldatas through HalalDAO or another approved timelock.
contract PrepareCPIAdapterHandoff is Script {
    function run() external view returns (address[] memory targets, uint256[] memory values, bytes[] memory calldatas) {
        address psm = vm.envAddress("PSM");
        address adapter = vm.envAddress("CPI_ADAPTER");
        address timelock = vm.envAddress("TIMELOCK");
        string memory source = vm.envString("CPI_SOURCE");
        bytes32 expectedSourceId = vm.envBytes32("EXPECTED_CPI_SOURCE_ID");
        address oldUpdater = vm.envOr("OLD_CPI_UPDATER", address(0));

        require(psm.code.length > 0, "PSM has no code");
        require(adapter.code.length > 0, "adapter has no code");
        require(timelock.code.length > 0, "timelock has no code");
        require(address(CPIReportAdapter(adapter).psm()) == psm, "adapter PSM mismatch");
        require(CPIReportAdapter(adapter).owner() == timelock, "adapter owner mismatch");
        require(CPIReportAdapter(adapter).sourceId() == expectedSourceId, "adapter source ID mismatch");
        require(bytes(source).length > 0, "source is empty");
        require(adapter != oldUpdater, "adapter cannot be old updater");

        (targets, values, calldatas) = CPIAdapterGovernance.buildHandoff(psm, adapter, source, oldUpdater);

        console.log("CPI adapter handoff actions:");
        for (uint256 i = 0; i < targets.length; ++i) {
            console.log("target", targets[i]);
            console.log("value", values[i]);
            console.logBytes(calldatas[i]);
        }
        console.log("Review sourceId, signer quorum, and timelock ownership before execution.");
    }
}
