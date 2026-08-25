// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { DeployHalalSystem } from "../script/Deploy.s.sol";

contract DeployHalalSystemHarness is DeployHalalSystem {
    function defaultVotingPeriod(uint256 chainId) external pure returns (uint256) {
        return _defaultVotingPeriod(chainId);
    }

    function expectedChainIdMatches(uint256 expectedChainId, uint256 actualChainId) external pure returns (bool) {
        return _isExpectedChainId(expectedChainId, actualChainId);
    }

    function beneficiariesAreDistinct(address teamBeneficiary, address treasuryBeneficiary)
        external
        pure
        returns (bool)
    {
        return _beneficiariesAreDistinct(teamBeneficiary, treasuryBeneficiary);
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

    function test_ExpectedChainIdMustMatchAndBeNonzero() public view {
        require(deployer.expectedChainIdMatches(31_337, 31_337));
        require(!deployer.expectedChainIdMatches(31_337, 42_161));
        require(!deployer.expectedChainIdMatches(0, 31_337));
    }

    function test_BeneficiariesMustBeDistinctAndNonzero() public view {
        require(deployer.beneficiariesAreDistinct(address(0x1), address(0x2)));
        require(!deployer.beneficiariesAreDistinct(address(0), address(0x2)));
        require(!deployer.beneficiariesAreDistinct(address(0x1), address(0)));
        require(!deployer.beneficiariesAreDistinct(address(0x1), address(0x1)));
    }
}
