// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";
import { HalalToken } from "../../src/HalalToken.sol";
import { HalalVesting } from "../../src/HalalVesting.sol";
import { HalalPSM } from "../../src/HalalPSM.sol";
import { HalalDAO } from "../../src/HalalDAO.sol";
import { HalalTimelock } from "../../src/HalalTimelock.sol";
import { MockERC20 } from "../mocks/MockERC20.sol";

/// @notice Deploys the full Halal system in the exact order/role-wiring the production Deploy.s.sol
/// script uses, so tests exercise the real genesis configuration (deployer ends up with zero
/// privileged roles; everything routes through the timelock/DAO).
abstract contract Deployers is Test {
    uint256 internal constant VOTING_DELAY = 1;
    uint32 internal constant VOTING_PERIOD = 50_400;
    uint256 internal constant PROPOSAL_THRESHOLD = 100e18;
    uint256 internal constant QUORUM_PERCENT = 4;
    uint256 internal constant TIMELOCK_DELAY = 2 days;

    address internal deployer = address(this);
    address internal teamBeneficiary = makeAddr("teamBeneficiary");
    address internal treasuryBeneficiary = makeAddr("treasuryBeneficiary");

    HalalTimelock internal timelock;
    HalalToken internal token;
    HalalVesting internal teamVesting;
    HalalVesting internal treasuryVesting;
    HalalDAO internal dao;
    HalalPSM internal psm;
    MockERC20 internal reserve;

    function deployAll() internal {
        address[] memory proposers = new address[](0);
        address[] memory executors = new address[](1);
        executors[0] = address(0); // open executor role

        timelock = new HalalTimelock(TIMELOCK_DELAY, proposers, executors, deployer);
        token = new HalalToken(deployer);

        teamVesting = new HalalVesting(
            address(token),
            teamBeneficiary,
            address(timelock),
            uint64(block.timestamp),
            365 days,
            4 * 365 days,
            token.TEAM_ALLOCATION(),
            true
        );

        treasuryVesting = new HalalVesting(
            address(token),
            treasuryBeneficiary,
            address(timelock),
            uint64(block.timestamp),
            0,
            3 * 365 days,
            token.TREASURY_ALLOCATION(),
            false
        );

        token.initialMint(address(teamVesting), address(treasuryVesting));

        // casting to 'uint48' is safe because VOTING_DELAY is the constant literal 1
        // forge-lint: disable-next-line(unsafe-typecast)
        dao = new HalalDAO(token, timelock, uint48(VOTING_DELAY), VOTING_PERIOD, PROPOSAL_THRESHOLD, QUORUM_PERCENT);

        reserve = new MockERC20("Mock DAI", "mDAI", 18);
        psm = new HalalPSM(address(reserve), address(token), address(timelock));

        // Wire roles: PSM can mint HLC; timelock becomes token admin; deployer gives up all roles.
        token.grantRole(token.MINTER_ROLE(), address(psm));
        token.grantRole(token.DEFAULT_ADMIN_ROLE(), address(timelock));
        token.revokeRole(token.MINTER_ROLE(), deployer);
        token.revokeRole(token.DEFAULT_ADMIN_ROLE(), deployer);

        // Wire timelock: DAO becomes proposer, deployer gives up admin. Deliberately no
        // CANCELLER_ROLE grant -- see the matching comment in script/Deploy.s.sol.
        timelock.grantRole(timelock.PROPOSER_ROLE(), address(dao));
        timelock.revokeRole(timelock.DEFAULT_ADMIN_ROLE(), deployer);
    }

    /// @dev Mints `amount` HLC-equivalent voting power to `voter` by depositing reserve through the
    /// PSM (the only way HLC enters circulation outside genesis vesting), then self-delegates so the
    /// tokens count as votes. Rolls one block afterward because ERC20Votes checkpoints for the
    /// current block aren't visible to `getPastVotes` until the following block -- Governor checks
    /// votes as of `clock() - 1`, so without this roll a same-block delegate+propose sees zero votes.
    function giveVotingPower(address voter, uint256 hlcAmount) internal {
        reserve.mint(voter, hlcAmount);
        vm.startPrank(voter);
        reserve.approve(address(psm), hlcAmount);
        psm.deposit(hlcAmount);
        token.delegate(voter);
        vm.stopPrank();
        vm.roll(block.number + 1);
    }
}
