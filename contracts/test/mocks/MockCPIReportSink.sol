// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

contract MockCPIReportSink {
    uint256 public lastCPI;
    uint256 public lastReportTimestamp;
    address public lastCaller;

    function updateCPIWithTimestamp(uint256 reportedCPI, uint256 reportedAt) external {
        lastCPI = reportedCPI;
        lastReportTimestamp = reportedAt;
        lastCaller = msg.sender;
    }
}
