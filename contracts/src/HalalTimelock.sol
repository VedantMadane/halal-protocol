// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";

/// @title HalalTimelock
/// @notice Standard OZ TimelockController used as the execution arm of HalalDAO. Deploy with
/// `proposers = []`, `executors = [address(0)]` (open executor role, matching the "anyone can call
/// execute() once queued" behavior described in the governance docs), and `admin = deployer`
/// temporarily. After HalalDAO is deployed, grant it PROPOSER_ROLE/CANCELLER_ROLE and have the
/// deployer renounce TIMELOCK_ADMIN_ROLE so only governance can administer the timelock from then on.
contract HalalTimelock is TimelockController {
    constructor(uint256 minDelay, address[] memory proposers, address[] memory executors, address admin)
        TimelockController(minDelay, proposers, executors, admin)
    { }
}
