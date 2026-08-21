// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Deployers } from "./utils/Deployers.sol";
import { HalalPSM } from "../src/HalalPSM.sol";
import { MockERC20 } from "./mocks/MockERC20.sol";

contract HalalPSMTest is Deployers {
    address internal alice = makeAddr("alice");

    function setUp() public {
        deployAll();
        reserve.mint(alice, 1_000_000e18);
        vm.prank(alice);
        reserve.approve(address(psm), type(uint256).max);
    }

    function test_DepositMintsOneToOneAtGenesisRate() public {
        vm.prank(alice);
        psm.deposit(1_000e18);
        assertEq(token.balanceOf(alice), 1_000e18);
        assertEq(reserve.balanceOf(address(psm)), 1_000e18);
    }

    function test_WithdrawBurnsAndReturnsReserve() public {
        vm.startPrank(alice);
        psm.deposit(1_000e18);
        token.approve(address(psm), 1_000e18);
        psm.withdraw(1_000e18);
        vm.stopPrank();

        assertEq(token.balanceOf(alice), 0);
        assertEq(reserve.balanceOf(alice), 1_000_000e18);
    }

    function test_RevertWhen_ZeroDeposit() public {
        vm.prank(alice);
        vm.expectRevert(HalalPSM.ZeroAmount.selector);
        psm.deposit(0);
    }

    function test_RevertWhen_WithdrawExceedsReserve() public {
        vm.prank(alice);
        psm.deposit(1_000e18);
        // drain the reserve out from under the PSM via a DAO reserve withdrawal
        vm.prank(address(timelock));
        psm.withdrawReserve(address(this), 1_000e18);

        vm.startPrank(alice);
        token.approve(address(psm), 1_000e18);
        vm.expectRevert(HalalPSM.InsufficientReserve.selector);
        psm.withdraw(1_000e18);
        vm.stopPrank();
    }

    function test_CPIAboveOneMeansFewerHLCPerDeposit() public {
        vm.prank(address(timelock));
        psm.mockCPI(1_200_000); // CPI +20%

        vm.prank(alice);
        psm.deposit(1_200e18);
        // 1200 reserve / 1.2 cpi = 1000 HLC
        assertEq(token.balanceOf(alice), 1_000e18);
    }

    function test_WithdrawAfterCPIIncreaseRequiresReserveTopUp() public {
        vm.prank(alice);
        psm.deposit(1_000e18); // mints 1000 HLC at cpi=1.0, reserve = 1000

        vm.prank(address(timelock));
        psm.mockCPI(1_100_000); // +10% -- redeeming 1000 HLC now needs 1100 reserve

        // the pool is under-collateralized for its one outstanding depositor until topped up
        assertLt(psm.reserveSurplus(), 0);
        uint256 shortfall = uint256(-psm.reserveSurplus());

        reserve.mint(address(timelock), shortfall);
        vm.startPrank(address(timelock));
        reserve.approve(address(psm), shortfall);
        psm.depositReserve(shortfall);
        vm.stopPrank();

        assertEq(psm.reserveSurplus(), 0);

        vm.startPrank(alice);
        token.approve(address(psm), 1_000e18);
        psm.withdraw(1_000e18); // 1000 * 1.1 = 1100 reserve back
        vm.stopPrank();

        assertEq(reserve.balanceOf(alice), 1_000_000e18 - 1_000e18 + 1_100e18);
    }

    function test_RevertWhen_MockCPIOutOfBounds() public {
        uint256 maxCpi = psm.MAX_CPI();
        uint256 minCpi = psm.MIN_CPI();

        vm.startPrank(address(timelock));
        vm.expectRevert(HalalPSM.RateOutOfBounds.selector);
        psm.mockCPI(maxCpi + 1);

        vm.expectRevert(HalalPSM.RateOutOfBounds.selector);
        psm.mockCPI(minCpi - 1);
        vm.stopPrank();
    }

    function test_MockCPIBypassesStepLimit() public {
        vm.prank(address(timelock));
        psm.mockCPI(2_000_000); // full range jump in one call, allowed for PARAM_ROLE
        assertEq(psm.cpiRate(), 2_000_000);
    }

    function test_RevertWhen_UnauthorizedMockCPI() public {
        vm.expectRevert();
        psm.mockCPI(1_100_000);
    }

    function test_UpdaterRoleEnforcesStepLimit() public {
        bytes32 updaterRole = psm.UPDATER_ROLE();
        vm.prank(address(timelock));
        psm.grantRole(updaterRole, address(this));

        // lastUpdated starts at deploy time, so even the first updater submission must wait out
        // minUpdateInterval before it's accepted
        vm.warp(block.timestamp + psm.minUpdateInterval() + 1);
        vm.expectRevert(HalalPSM.StepTooLarge.selector);
        psm.updateCPI(1_300_000); // >20% jump from 1.0
    }

    function test_UpdaterRoleEnforcesMinInterval() public {
        bytes32 updaterRole = psm.UPDATER_ROLE();
        vm.prank(address(timelock));
        psm.grantRole(updaterRole, address(this));

        vm.warp(block.timestamp + psm.minUpdateInterval() + 1);
        psm.updateCPI(1_050_000);
        vm.expectRevert(HalalPSM.UpdateTooSoon.selector);
        psm.updateCPI(1_060_000);
    }

    function test_UpdaterCanUpdateAfterIntervalElapses() public {
        bytes32 updaterRole = psm.UPDATER_ROLE();
        vm.prank(address(timelock));
        psm.grantRole(updaterRole, address(this));

        vm.warp(block.timestamp + psm.minUpdateInterval() + 1);
        psm.updateCPI(1_050_000);
        vm.warp(block.timestamp + psm.minUpdateInterval() + 1);
        psm.updateCPI(1_080_000);
        assertEq(psm.cpiRate(), 1_080_000);
    }

    function test_DepositReserveByDAO() public {
        reserve.mint(address(timelock), 500e18);
        vm.startPrank(address(timelock));
        reserve.approve(address(psm), 500e18);
        psm.depositReserve(500e18);
        vm.stopPrank();
        assertEq(reserve.balanceOf(address(psm)), 500e18);
    }

    function test_RevertWhen_UnauthorizedDepositReserve() public {
        vm.expectRevert();
        psm.depositReserve(1e18);
    }

    function test_SetSourceByDAO() public {
        vm.prank(address(timelock));
        psm.setSource("https://example.com/cpi.js");
        assertEq(psm.source(), "https://example.com/cpi.js");
    }

    function test_DecimalNormalization_SixDecimalReserve() public {
        MockERC20 usdc = new MockERC20("Mock USDC", "mUSDC", 6);
        HalalPSM usdcPsm = new HalalPSM(address(usdc), address(token), address(timelock));
        bytes32 minterRole = token.MINTER_ROLE();
        vm.prank(address(timelock));
        token.grantRole(minterRole, address(usdcPsm));

        usdc.mint(alice, 1_000e6);
        vm.startPrank(alice);
        usdc.approve(address(usdcPsm), 1_000e6);
        usdcPsm.deposit(1_000e6);
        vm.stopPrank();

        assertEq(token.balanceOf(alice), 1_000e18);

        vm.startPrank(alice);
        token.approve(address(usdcPsm), 1_000e18);
        usdcPsm.withdraw(1_000e18);
        vm.stopPrank();
        assertEq(usdc.balanceOf(alice), 1_000e6);
    }

    function test_PreviewMatchesActualDeposit() public {
        uint256 preview = psm.previewDeposit(777e18);
        vm.prank(alice);
        psm.deposit(777e18);
        assertEq(token.balanceOf(alice), preview);
    }

    function test_SetMinUpdateIntervalByDAO() public {
        vm.prank(address(timelock));
        psm.setMinUpdateInterval(7 days);
        assertEq(psm.minUpdateInterval(), 7 days);
    }

    function test_RevertWhen_UnauthorizedSetMinUpdateInterval() public {
        vm.expectRevert();
        psm.setMinUpdateInterval(7 days);
    }

    function test_DecimalNormalization_HighDecimalReserve() public {
        // exercises the decimals > HLC_DECIMALS branch of the scaling helpers (e.g. a hypothetical
        // 24-decimal reserve token)
        MockERC20 highDecimal = new MockERC20("High Decimal", "mHD", 24);
        HalalPSM hdPsm = new HalalPSM(address(highDecimal), address(token), address(timelock));
        bytes32 minterRole = token.MINTER_ROLE();
        vm.prank(address(timelock));
        token.grantRole(minterRole, address(hdPsm));

        highDecimal.mint(alice, 1_000e24);
        vm.startPrank(alice);
        highDecimal.approve(address(hdPsm), 1_000e24);
        hdPsm.deposit(1_000e24);
        vm.stopPrank();

        assertEq(token.balanceOf(alice), 1_000e18);

        vm.startPrank(alice);
        token.approve(address(hdPsm), 1_000e18);
        hdPsm.withdraw(1_000e18);
        vm.stopPrank();
        assertEq(highDecimal.balanceOf(alice), 1_000e24);
    }

    // ── Redemption rights are per-depositor, not per-token ──────────────

    function test_RevertWhen_GenesisHLCTriesToDrainReserve() public {
        // fund the reserve with a real depositor
        vm.prank(alice);
        psm.deposit(1_000e18);

        // team vesting fully unlocks -- these HLC were never backed by any reserve deposit
        vm.warp(block.timestamp + 4 * 365 days + 1);
        teamVesting.release();
        assertGt(token.balanceOf(teamBeneficiary), 0);

        // the beneficiary holds plenty of HLC, but has never deposited into this PSM
        vm.startPrank(teamBeneficiary);
        token.approve(address(psm), 1_000e18);
        vm.expectRevert(HalalPSM.InsufficientRedeemableBalance.selector);
        psm.withdraw(1_000e18);
        vm.stopPrank();

        // alice's own reserve is untouched and she can still redeem it
        vm.startPrank(alice);
        token.approve(address(psm), 1_000e18);
        psm.withdraw(1_000e18);
        vm.stopPrank();
        assertEq(reserve.balanceOf(alice), 1_000_000e18);
    }

    function test_RevertWhen_RecipientOfTransferredPSMHLCRedeems() public {
        address bob = makeAddr("bob");

        vm.prank(alice);
        psm.deposit(1_000e18);

        vm.prank(alice);
        bool ok = token.transfer(bob, 1_000e18);
        assertTrue(ok);

        vm.startPrank(bob);
        token.approve(address(psm), 1_000e18);
        vm.expectRevert(HalalPSM.InsufficientRedeemableBalance.selector);
        psm.withdraw(1_000e18);
        vm.stopPrank();
    }

    function test_RedeemableBalanceTracksDepositsAndWithdrawals() public {
        vm.startPrank(alice);
        psm.deposit(1_000e18);
        assertEq(psm.redeemableBalance(alice), 1_000e18);
        assertEq(psm.totalHlcIssued(), 1_000e18);

        token.approve(address(psm), 400e18);
        psm.withdraw(400e18);
        vm.stopPrank();

        assertEq(psm.redeemableBalance(alice), 600e18);
        assertEq(psm.totalHlcIssued(), 600e18);
    }

    function test_RevertWhen_WithdrawExceedsOwnRedeemableBalance() public {
        vm.startPrank(alice);
        psm.deposit(500e18);
        token.approve(address(psm), 600e18);
        vm.expectRevert(HalalPSM.InsufficientRedeemableBalance.selector);
        psm.withdraw(600e18);
        vm.stopPrank();
    }
}
