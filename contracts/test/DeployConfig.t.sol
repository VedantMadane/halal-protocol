// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { DeployHalalSystem } from "../script/Deploy.s.sol";

contract DeployHalalSystemHarness is DeployHalalSystem {
    function defaultVotingPeriod(uint256 chainId) external pure returns (uint256) {
        return _defaultVotingPeriod(chainId);
    }
}

contract DeployConfigTest {
    DeployHalalSystemHarness internal deployer = new DeployHalalSystemHarness();

    function test_ArbitrumDefaultsToOneWeekVotingPeriod() public view {
        require(deployer.defaultVotingPeriod(42_161) == 2_419_200);
        require(deployer.defaultVotingPeriod(421_614) == 2_419_200);
    }

    function test_NonArbitrumKeepsEthereumOrLocalDefault() public view {
        require(deployer.defaultVotingPeriod(1) == 50_400);
        require(deployer.defaultVotingPeriod(31_337) == 50_400);
    }
}
