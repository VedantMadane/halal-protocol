// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Deployers } from "./utils/Deployers.sol";
import { HalalVesting } from "../src/HalalVesting.sol";

contract HalalVestingTest is Deployers {
    function setUp() public {
        deployAll();
    }

    function test_VestingInitialized() public view {
        assertEq(teamVesting.totalAllocation(), 6_000_000e18);
        assertEq(teamVesting.cliff(), 365 days);
        assertEq(teamVesting.duration(), 4 * 365 days);
        assertTrue(teamVesting.revocable());

        assertEq(treasuryVesting.totalAllocation(), 4_000_000e18);
        assertEq(treasuryVesting.cliff(), 0);
        assertEq(treasuryVesting.duration(), 3 * 365 days);
        assertFalse(treasuryVesting.revocable());
    }

    function test_NothingVestedBeforeCliff() public {
        vm.warp(block.timestamp + 364 days);
        assertEq(teamVesting.releasable(), 0);
    }

    function test_RevertWhen_ReleaseBeforeCliff() public {
        vm.expectRevert(HalalVesting.NothingToRelease.selector);
        teamVesting.release();
    }

    function test_LinearVestingAfterCliff() public {
        vm.warp(block.timestamp + 365 days + 365 days); // 1 cliff + 1 year into the 4-year schedule
        uint256 expected = (6_000_000e18 * (365 days + 365 days)) / (4 * 365 days);
        assertEq(teamVesting.releasable(), expected);
    }

    function test_FullyVestedAfterDuration() public {
        vm.warp(block.timestamp + 4 * 365 days + 1);
        assertEq(teamVesting.releasable(), 6_000_000e18);
    }

    function test_VestedAmountHandlesMaxAllocationWithoutOverflow() public {
        uint64 start = uint64(block.timestamp);
        HalalVesting large = new HalalVesting(
            address(token), teamBeneficiary, address(timelock), start, 0, 2, type(uint256).max, true
        );

        assertEq(large.vestedAmount(start + 1), type(uint256).max / 2);
    }

    function test_ReleaseSendsToBeneficiary() public {
        vm.warp(block.timestamp + 4 * 365 days + 1);
        teamVesting.release();
        assertEq(token.balanceOf(teamBeneficiary), 6_000_000e18);
        assertEq(teamVesting.released(), 6_000_000e18);
    }

    function test_ReleaseIsIdempotentBetweenCalls() public {
        vm.warp(block.timestamp + 365 days + 365 days);
        teamVesting.release();
        uint256 firstRelease = teamVesting.released();

        vm.warp(block.timestamp + 365 days);
        teamVesting.release();
        assertGt(teamVesting.released(), firstRelease);
        assertEq(token.balanceOf(teamBeneficiary), teamVesting.released());
    }

    function test_AnyoneCanTriggerRelease() public {
        vm.warp(block.timestamp + 4 * 365 days + 1);
        vm.prank(address(0xDEAD));
        teamVesting.release();
        assertEq(token.balanceOf(teamBeneficiary), 6_000_000e18);
    }

    function test_TeamVestingRevocable() public {
        vm.warp(block.timestamp + 365 days + 365 days); // 1/4 of the way through
        uint256 vested = teamVesting.vestedAmount(uint64(block.timestamp));

        vm.prank(address(timelock));
        teamVesting.revoke();

        assertTrue(teamVesting.revoked());
        assertEq(token.balanceOf(address(timelock)), 6_000_000e18 - vested);
        // vesting stays frozen at the revoke-time amount even as time passes
        vm.warp(block.timestamp + 10 * 365 days);
        assertEq(teamVesting.releasable(), vested);
    }

    function test_RevokeAfterPartialReleaseReturnsOnlyUnvestedTokens() public {
        vm.warp(block.timestamp + 365 days + 365 days);
        uint256 vested = teamVesting.vestedAmount(uint64(block.timestamp));
        teamVesting.release();

        vm.warp(block.timestamp + 365 days);
        uint256 vestedAtRevoke = teamVesting.vestedAmount(uint64(block.timestamp));

        vm.prank(address(timelock));
        teamVesting.revoke();

        assertEq(teamVesting.released(), vested);
        assertEq(teamVesting.revokedVestedAmount(), vestedAtRevoke);
        assertEq(token.balanceOf(address(timelock)), 6_000_000e18 - vestedAtRevoke);
        assertEq(teamVesting.releasable(), vestedAtRevoke - vested);
    }

    function test_RevokeWhenFullyVestedReturnsNothing() public {
        vm.warp(block.timestamp + 4 * 365 days + 1);
        teamVesting.release();

        vm.prank(address(timelock));
        teamVesting.revoke();

        assertEq(teamVesting.released(), 6_000_000e18);
        assertEq(teamVesting.revokedVestedAmount(), 6_000_000e18);
        assertEq(token.balanceOf(address(timelock)), 0);
        assertEq(teamVesting.releasable(), 0);
    }

    function test_TreasuryVestingNonRevocable() public {
        vm.prank(address(timelock));
        vm.expectRevert(HalalVesting.NotRevocable.selector);
        treasuryVesting.revoke();
    }

    function test_RevertWhen_NonDAORevokes() public {
        vm.expectRevert(HalalVesting.NotDAO.selector);
        teamVesting.revoke();
    }

    function test_RevertWhen_DoubleRevoke() public {
        vm.startPrank(address(timelock));
        teamVesting.revoke();
        vm.expectRevert(HalalVesting.AlreadyRevoked.selector);
        teamVesting.revoke();
        vm.stopPrank();
    }

    function test_BeneficiaryTransferRequiresAcceptance() public {
        vm.prank(teamBeneficiary);
        teamVesting.proposeBeneficiary(address(0x1234));
        assertEq(teamVesting.beneficiary(), teamBeneficiary); // unchanged until accepted
        assertEq(teamVesting.pendingBeneficiary(), address(0x1234));

        vm.prank(address(0x1234));
        teamVesting.acceptBeneficiary();
        assertEq(teamVesting.beneficiary(), address(0x1234));
        assertEq(teamVesting.pendingBeneficiary(), address(0));
    }

    function test_RevertWhen_NonBeneficiaryProposesTransfer() public {
        vm.expectRevert(HalalVesting.NotBeneficiary.selector);
        teamVesting.proposeBeneficiary(address(0x1234));
    }

    function test_RevertWhen_WrongAddressAcceptsBeneficiary() public {
        vm.prank(teamBeneficiary);
        teamVesting.proposeBeneficiary(address(0x1234));

        vm.expectRevert(HalalVesting.NotPendingBeneficiary.selector);
        teamVesting.acceptBeneficiary();
    }

    function test_RevertWhen_ZeroAddressInConstructor() public {
        vm.expectRevert(HalalVesting.ZeroAddress.selector);
        new HalalVesting(address(0), teamBeneficiary, address(timelock), uint64(block.timestamp), 0, 1, 1e18, true);
    }

    function test_RevertWhen_ZeroAllocationInConstructor() public {
        vm.expectRevert(HalalVesting.ZeroAllocation.selector);
        new HalalVesting(address(token), teamBeneficiary, address(timelock), uint64(block.timestamp), 0, 1, 0, true);
    }

    function test_RevertWhen_ZeroDurationInConstructor() public {
        vm.expectRevert(HalalVesting.ZeroDuration.selector);
        new HalalVesting(address(token), teamBeneficiary, address(timelock), uint64(block.timestamp), 0, 0, 1e18, true);
    }

    function test_RevertWhen_CliffExceedsDurationInConstructor() public {
        vm.expectRevert(HalalVesting.CliffExceedsDuration.selector);
        new HalalVesting(
            address(token), teamBeneficiary, address(timelock), uint64(block.timestamp), 100, 50, 1e18, true
        );
    }

    function test_RevertWhen_ScheduleOverflowsTimestamp() public {
        vm.expectRevert(HalalVesting.ScheduleOverflow.selector);
        new HalalVesting(address(token), teamBeneficiary, address(timelock), type(uint64).max, 0, 1, 1e18, true);
    }
}
