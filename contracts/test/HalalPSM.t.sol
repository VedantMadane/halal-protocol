// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Deployers } from "./utils/Deployers.sol";
import { HalalPSM } from "../src/HalalPSM.sol";
import { MockERC20 } from "./mocks/MockERC20.sol";
import { MockFeeOnTransferERC20 } from "./mocks/MockFeeOnTransferERC20.sol";
import { MockOutgoingFeeERC20 } from "./mocks/MockOutgoingFeeERC20.sol";
import { MockReentrantERC20 } from "./mocks/MockReentrantERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

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

    function test_BoundedDepositRevertsWhenQuoteGetsWorse() public {
        uint256 quotedOutput = psm.previewDeposit(1_000e18);

        vm.prank(address(timelock));
        psm.mockCPI(1_100_000);

        vm.startPrank(alice);
        vm.expectRevert(HalalPSM.SlippageExceeded.selector);
        psm.depositWithMinHlcOut(1_000e18, quotedOutput);
        vm.stopPrank();

        assertEq(reserve.balanceOf(address(psm)), 0);
        assertEq(token.balanceOf(alice), 0);
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

    function test_BoundedWithdrawRevertsWhenQuoteGetsWorse() public {
        vm.prank(alice);
        psm.deposit(1_000e18);
        uint256 quotedOutput = psm.previewWithdraw(1_000e18);

        vm.prank(address(timelock));
        psm.mockCPI(900_000);

        vm.startPrank(alice);
        token.approve(address(psm), 1_000e18);
        vm.expectRevert(HalalPSM.SlippageExceeded.selector);
        psm.withdrawWithMinReserveOut(1_000e18, quotedOutput);
        vm.stopPrank();

        assertEq(token.balanceOf(alice), 1_000e18);
        assertEq(psm.redeemableBalance(alice), 1_000e18);
    }

    function testFuzz_RoundTripNeverOverpays(uint128 reserveAmount) public {
        vm.assume(reserveAmount >= 1e12 && reserveAmount <= 1e24);

        vm.prank(address(timelock));
        psm.mockCPI(1_100_000);

        uint256 aliceReserveBefore = reserve.balanceOf(alice);
        vm.startPrank(alice);
        psm.deposit(reserveAmount);
        uint256 hlcIssued = psm.redeemableBalance(alice);
        token.approve(address(psm), hlcIssued);
        psm.withdraw(hlcIssued);
        vm.stopPrank();

        assertLe(aliceReserveBefore - reserve.balanceOf(alice), reserveAmount);
        assertEq(psm.totalHlcIssued(), 0);
        assertEq(psm.redeemableBalance(alice), 0);
    }

    function test_RevertWhen_ZeroDeposit() public {
        vm.prank(alice);
        vm.expectRevert(HalalPSM.ZeroAmount.selector);
        psm.deposit(0);
    }

    function test_RevertWhen_DepositRoundsDownToZeroHLC() public {
        MockERC20 highDecimal = new MockERC20("High Decimal", "mHD", 24);
        HalalPSM highDecimalPsm = new HalalPSM(address(highDecimal), address(token), address(timelock), address(0));

        highDecimal.mint(alice, 1);
        vm.startPrank(alice);
        highDecimal.approve(address(highDecimalPsm), 1);
        vm.expectRevert(HalalPSM.InsufficientOutput.selector);
        highDecimalPsm.deposit(1);
        vm.stopPrank();

        assertEq(highDecimal.balanceOf(address(highDecimalPsm)), 0);
        assertEq(token.balanceOf(alice), 0);
    }

    function test_RevertWhen_ReserveDecimalsAreUnsupported() public {
        MockERC20 unsupported = new MockERC20("Unsupported", "mUN", 78);
        vm.expectRevert(HalalPSM.UnsupportedDecimals.selector);
        new HalalPSM(address(unsupported), address(token), address(timelock), address(0));
    }

    function test_RevertWhen_DAOWithdrawsRequiredReserve() public {
        vm.prank(alice);
        psm.deposit(1_000e18);

        vm.prank(address(timelock));
        vm.expectRevert(HalalPSM.InsufficientReserve.selector);
        psm.withdrawReserve(address(this), 1_000e18);

        vm.startPrank(alice);
        token.approve(address(psm), 1_000e18);
        psm.withdraw(1_000e18);
        vm.stopPrank();

        assertEq(reserve.balanceOf(alice), 1_000_000e18);
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

    function test_PartialWithdrawalDoesNotWorsenExistingCPIShortfall() public {
        vm.prank(alice);
        psm.deposit(1_000e18);

        vm.prank(address(timelock));
        psm.mockCPI(1_100_000);

        vm.startPrank(alice);
        token.approve(address(psm), 100e18);
        psm.withdraw(100e18);
        vm.stopPrank();

        assertEq(reserve.balanceOf(address(psm)), 890e18);
        assertEq(psm.reserveRequired(), 990e18);
        assertEq(psm.reserveSurplus(), -100e18);
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

    function test_ConstructorCanBootstrapUpdaterAndDAOCanRevokeIt() public {
        MockERC20 updaterReserve = new MockERC20("Updater DAI", "uDAI", 18);
        address updater = makeAddr("bootstrappedUpdater");
        HalalPSM bootstrappedPsm = new HalalPSM(address(updaterReserve), address(token), address(timelock), updater);

        assertTrue(bootstrappedPsm.hasRole(bootstrappedPsm.UPDATER_ROLE(), updater));

        vm.warp(block.timestamp + bootstrappedPsm.minUpdateInterval() + 1);
        vm.prank(updater);
        bootstrappedPsm.updateCPI(1_050_000);
        assertEq(bootstrappedPsm.cpiRate(), 1_050_000);

        bytes32 updaterRole = bootstrappedPsm.UPDATER_ROLE();
        vm.prank(address(timelock));
        bootstrappedPsm.revokeRole(updaterRole, updater);
        assertFalse(bootstrappedPsm.hasRole(updaterRole, updater));
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

    function test_UpdaterAcceptsFreshTimestampedReport() public {
        bytes32 updaterRole = psm.UPDATER_ROLE();
        vm.prank(address(timelock));
        psm.grantRole(updaterRole, address(this));

        vm.warp(block.timestamp + psm.minUpdateInterval() + 1);
        uint256 reportTimestamp = block.timestamp - 1;
        psm.updateCPIWithTimestamp(1_050_000, reportTimestamp);

        assertEq(psm.cpiRate(), 1_050_000);
        assertEq(psm.lastReportTimestamp(), reportTimestamp);
    }

    function test_FirstTimestampedReportCanPrecedeDeployment() public {
        bytes32 updaterRole = psm.UPDATER_ROLE();
        vm.prank(address(timelock));
        psm.grantRole(updaterRole, address(this));

        uint256 reportTimestamp = psm.lastUpdated() - 1;
        vm.warp(block.timestamp + psm.minUpdateInterval() + 1);
        psm.updateCPIWithTimestamp(1_050_000, reportTimestamp);

        assertEq(psm.lastReportTimestamp(), reportTimestamp);
    }

    function test_UpdaterRejectsReplayedTimestampedReport() public {
        bytes32 updaterRole = psm.UPDATER_ROLE();
        vm.prank(address(timelock));
        psm.grantRole(updaterRole, address(this));

        vm.warp(block.timestamp + psm.minUpdateInterval() + 1);
        uint256 reportTimestamp = block.timestamp - 1;
        psm.updateCPIWithTimestamp(1_050_000, reportTimestamp);

        vm.warp(block.timestamp + psm.minUpdateInterval() + 1);
        vm.expectRevert(HalalPSM.InvalidReportTimestamp.selector);
        psm.updateCPIWithTimestamp(1_060_000, reportTimestamp);
    }

    function test_UpdaterRejectsFutureOrTooOldReport() public {
        bytes32 updaterRole = psm.UPDATER_ROLE();
        vm.prank(address(timelock));
        psm.grantRole(updaterRole, address(this));

        vm.warp(block.timestamp + psm.minUpdateInterval() + 1);
        vm.expectRevert(HalalPSM.InvalidReportTimestamp.selector);
        psm.updateCPIWithTimestamp(1_050_000, block.timestamp + 1);

        uint256 oldReportTimestamp = psm.lastReportTimestamp() + 1;
        vm.warp(oldReportTimestamp + psm.MAX_REPORT_AGE() + 1);
        vm.expectRevert(HalalPSM.ReportTooOld.selector);
        psm.updateCPIWithTimestamp(1_050_000, oldReportTimestamp);
    }

    function test_GovernanceOverrideAdvancesReportWatermark() public {
        bytes32 updaterRole = psm.UPDATER_ROLE();
        vm.prank(address(timelock));
        psm.grantRole(updaterRole, address(this));

        vm.warp(block.timestamp + psm.minUpdateInterval() + 1);
        uint256 reportTimestamp = block.timestamp - 1;
        psm.updateCPIWithTimestamp(1_050_000, reportTimestamp);

        vm.warp(block.timestamp + psm.minUpdateInterval() + 1);
        vm.prank(address(timelock));
        psm.mockCPI(1_040_000);

        vm.warp(block.timestamp + psm.minUpdateInterval() + 1);
        vm.expectRevert(HalalPSM.InvalidReportTimestamp.selector);
        psm.updateCPIWithTimestamp(1_060_000, reportTimestamp);
    }

    function test_UpdaterCannotRaiseRateAboveHeldReserve() public {
        vm.prank(alice);
        psm.deposit(1_000e18);

        bytes32 updaterRole = psm.UPDATER_ROLE();
        vm.prank(address(timelock));
        psm.grantRole(updaterRole, address(this));

        vm.warp(block.timestamp + psm.minUpdateInterval() + 1);
        vm.expectRevert(HalalPSM.RateWouldUnderCollateralize.selector);
        psm.updateCPI(1_100_000);

        assertEq(psm.cpiRate(), psm.CPI_PRECISION());
        assertEq(psm.lastUpdated(), block.timestamp - psm.minUpdateInterval() - 1);
    }

    function test_UpdaterCanRaiseRateAfterReserveTopUp() public {
        vm.prank(alice);
        psm.deposit(1_000e18);

        reserve.mint(address(timelock), 100e18);
        vm.startPrank(address(timelock));
        reserve.approve(address(psm), 100e18);
        psm.depositReserve(100e18);
        psm.grantRole(psm.UPDATER_ROLE(), address(this));
        vm.stopPrank();

        vm.warp(block.timestamp + psm.minUpdateInterval() + 1);
        psm.updateCPI(1_100_000);
        assertEq(psm.cpiRate(), 1_100_000);
        assertEq(psm.reserveSurplus(), 0);
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

    function test_UpdaterLargeIntervalUsesExpectedRevert() public {
        bytes32 updaterRole = psm.UPDATER_ROLE();
        vm.startPrank(address(timelock));
        psm.setMinUpdateInterval(type(uint256).max);
        psm.grantRole(updaterRole, address(this));
        vm.stopPrank();

        vm.expectRevert(HalalPSM.UpdateTooSoon.selector);
        psm.updateCPI(1_050_000);
    }

    function test_DepositReserveByDAO() public {
        reserve.mint(address(timelock), 500e18);
        vm.startPrank(address(timelock));
        reserve.approve(address(psm), 500e18);
        psm.depositReserve(500e18);
        vm.stopPrank();
        assertEq(reserve.balanceOf(address(psm)), 500e18);
    }

    function test_RevertWhen_DAOReserveTopUpReceivesNothing() public {
        MockFeeOnTransferERC20 feeReserve = new MockFeeOnTransferERC20(10_000);
        HalalPSM feePsm = new HalalPSM(address(feeReserve), address(token), address(timelock), address(0));
        feeReserve.mint(address(timelock), 1e18);

        vm.startPrank(address(timelock));
        feeReserve.approve(address(feePsm), 1e18);
        vm.expectRevert(HalalPSM.ZeroReceived.selector);
        feePsm.depositReserve(1e18);
        vm.stopPrank();

        assertEq(feeReserve.balanceOf(address(feePsm)), 0);
    }

    function test_DAOCanWithdrawOnlyReserveSurplus() public {
        vm.prank(alice);
        psm.deposit(1_000e18);

        reserve.mint(address(timelock), 500e18);
        vm.startPrank(address(timelock));
        reserve.approve(address(psm), 500e18);
        psm.depositReserve(500e18);
        psm.withdrawReserve(address(this), 500e18);
        vm.stopPrank();

        assertEq(reserve.balanceOf(address(psm)), psm.reserveRequired());
        assertEq(reserve.balanceOf(address(this)), 500e18);
    }

    function test_ReserveSurplusSaturatesAtInt256Bounds() public {
        reserve.mint(address(psm), uint256(type(int256).max) + 1);
        assertEq(psm.reserveSurplus(), type(int256).max);
    }

    function test_BoundedWithdrawalAccountsForFeeOnTransferReserve() public {
        MockFeeOnTransferERC20 feeReserve = new MockFeeOnTransferERC20(100); // 1% per transfer
        HalalPSM feePsm = new HalalPSM(address(feeReserve), address(token), address(timelock), address(0));
        bytes32 minterRole = token.MINTER_ROLE();
        vm.prank(address(timelock));
        token.grantRole(minterRole, address(feePsm));

        feeReserve.mint(alice, 1_000e18);
        vm.startPrank(alice);
        feeReserve.approve(address(feePsm), type(uint256).max);
        feePsm.deposit(1_000e18); // PSM receives 990 fDAI and mints 990 HLC
        token.approve(address(feePsm), 990e18);
        uint256 quoted = feePsm.previewWithdraw(990e18);
        vm.expectRevert(HalalPSM.SlippageExceeded.selector);
        feePsm.withdrawWithMinReserveOut(990e18, quoted);
        vm.stopPrank();

        assertEq(feePsm.redeemableBalance(alice), 990e18);
        assertEq(token.balanceOf(alice), 990e18);
    }

    function test_RevertWhen_OutgoingReserveTransferWouldBreachFloor() public {
        MockOutgoingFeeERC20 outgoingFeeReserve = new MockOutgoingFeeERC20(100); // 1% extra debit
        HalalPSM outgoingFeePsm =
            new HalalPSM(address(outgoingFeeReserve), address(token), address(timelock), address(0));
        bytes32 minterRole = token.MINTER_ROLE();
        vm.prank(address(timelock));
        token.grantRole(minterRole, address(outgoingFeePsm));

        outgoingFeeReserve.mint(alice, 2_100e18);
        vm.startPrank(alice);
        outgoingFeeReserve.approve(address(outgoingFeePsm), type(uint256).max);
        outgoingFeePsm.deposit(2_000e18);
        token.approve(address(outgoingFeePsm), 1_000e18);
        vm.stopPrank();

        // Leave just enough nominal surplus for the transfer, but not its extra debit.
        outgoingFeeReserve.mint(address(outgoingFeePsm), 5e18);
        vm.prank(alice);
        vm.expectRevert(HalalPSM.InsufficientReserve.selector);
        outgoingFeePsm.withdraw(1_000e18);

        assertEq(outgoingFeePsm.totalHlcIssued(), 2_000e18);
        assertEq(outgoingFeeReserve.balanceOf(address(outgoingFeePsm)), 2_005e18);
    }

    function test_RevertWhen_DAOReserveTransferWouldBreachFloor() public {
        MockOutgoingFeeERC20 outgoingFeeReserve = new MockOutgoingFeeERC20(100); // 1% extra debit
        HalalPSM outgoingFeePsm =
            new HalalPSM(address(outgoingFeeReserve), address(token), address(timelock), address(0));
        bytes32 minterRole = token.MINTER_ROLE();
        vm.prank(address(timelock));
        token.grantRole(minterRole, address(outgoingFeePsm));

        outgoingFeeReserve.mint(alice, 2_100e18);
        vm.startPrank(alice);
        outgoingFeeReserve.approve(address(outgoingFeePsm), type(uint256).max);
        outgoingFeePsm.deposit(2_000e18);
        vm.stopPrank();
        outgoingFeeReserve.mint(address(outgoingFeePsm), 5e18);

        vm.prank(address(timelock));
        vm.expectRevert(HalalPSM.InsufficientReserve.selector);
        outgoingFeePsm.withdrawReserve(address(this), 5e18);

        assertEq(outgoingFeeReserve.balanceOf(address(outgoingFeePsm)), 2_005e18);
    }

    function test_AdminReserveTransferIsReentrancyGuarded() public {
        MockReentrantERC20 reentrantReserve = new MockReentrantERC20();
        HalalPSM reentrantPsm = new HalalPSM(address(reentrantReserve), address(token), address(timelock), address(0));

        vm.startPrank(address(timelock));
        reentrantPsm.grantRole(reentrantPsm.PARAM_ROLE(), address(reentrantReserve));
        vm.stopPrank();
        reentrantReserve.mint(address(reentrantPsm), 100e18);
        reentrantReserve.configureReentry(address(reentrantPsm), address(this), 100e18);

        vm.startPrank(address(timelock));
        vm.expectRevert();
        reentrantPsm.withdrawReserve(address(this), 100e18);
        vm.stopPrank();

        assertEq(reentrantReserve.balanceOf(address(reentrantPsm)), 100e18);
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
        HalalPSM usdcPsm = new HalalPSM(address(usdc), address(token), address(timelock), address(0));
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

    function test_RevertWhen_WithdrawalRoundsDownToZeroReserve() public {
        MockERC20 usdc = new MockERC20("Mock USDC", "mUSDC", 6);
        HalalPSM usdcPsm = new HalalPSM(address(usdc), address(token), address(timelock), address(0));
        bytes32 minterRole = token.MINTER_ROLE();
        vm.prank(address(timelock));
        token.grantRole(minterRole, address(usdcPsm));

        usdc.mint(alice, 1e6);
        vm.startPrank(alice);
        usdc.approve(address(usdcPsm), 1e6);
        usdcPsm.deposit(1e6);
        token.approve(address(usdcPsm), 1);
        vm.expectRevert(HalalPSM.InsufficientOutput.selector);
        usdcPsm.withdraw(1);
        vm.stopPrank();

        assertEq(token.balanceOf(alice), 1e18);
        assertEq(usdcPsm.redeemableBalance(alice), 1e18);
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

    function test_RevertWhen_MinUpdateIntervalIsZero() public {
        vm.prank(address(timelock));
        vm.expectRevert(HalalPSM.InvalidUpdateInterval.selector);
        psm.setMinUpdateInterval(0);
    }

    function test_DecimalNormalization_HighDecimalReserve() public {
        // exercises the decimals > HLC_DECIMALS branch of the scaling helpers (e.g. a hypothetical
        // 24-decimal reserve token)
        MockERC20 highDecimal = new MockERC20("High Decimal", "mHD", 24);
        HalalPSM hdPsm = new HalalPSM(address(highDecimal), address(token), address(timelock), address(0));
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

    function test_HighDecimalReserveRetainsPrecisionAtNonGenesisCPI() public {
        MockERC20 highDecimal = new MockERC20("High Decimal", "mHD", 24);
        HalalPSM hdPsm = new HalalPSM(address(highDecimal), address(token), address(timelock), address(0));
        bytes32 minterRole = token.MINTER_ROLE();
        vm.prank(address(timelock));
        token.grantRole(minterRole, address(hdPsm));

        vm.prank(address(timelock));
        hdPsm.mockCPI(1_200_000);

        // 1.2e-18 reserve tokens is exactly 1 base unit of HLC at a 1.2 CPI rate. The old
        // two-stage conversion truncated this to zero before applying the CPI conversion.
        highDecimal.mint(alice, 1_200_000);
        vm.startPrank(alice);
        highDecimal.approve(address(hdPsm), 1_200_000);
        hdPsm.deposit(1_200_000);
        vm.stopPrank();

        assertEq(hdPsm.redeemableBalance(alice), 1);
        assertEq(hdPsm.previewWithdraw(1), 1_200_000);
    }

    function test_PreviewDepositUsesFullPrecisionForLargeLowDecimalAmount() public {
        MockERC20 zeroDecimal = new MockERC20("Zero Decimal", "mZERO", 0);
        HalalPSM zeroDecimalPsm = new HalalPSM(address(zeroDecimal), address(token), address(timelock), address(0));

        uint256 maxCpi = zeroDecimalPsm.MAX_CPI();
        vm.prank(address(timelock));
        zeroDecimalPsm.mockCPI(maxCpi);

        // The 18-decimal scaling intermediate overflows for this input, while the final HLC
        // result remains representable because the CPI rate divides it by two.
        uint256 amount = type(uint256).max / 1e18;
        amount = amount * 3;
        amount /= 2;
        uint256 expected = Math.mulDiv(amount, 1e18 * zeroDecimalPsm.CPI_PRECISION(), zeroDecimalPsm.cpiRate());
        assertEq(zeroDecimalPsm.previewDeposit(amount), expected);

        uint256 largeHlcAmount = type(uint256).max;
        uint256 expectedReserve =
            Math.mulDiv(largeHlcAmount, zeroDecimalPsm.cpiRate(), zeroDecimalPsm.CPI_PRECISION() * 1e18);
        assertEq(zeroDecimalPsm.previewWithdraw(largeHlcAmount), expectedReserve);
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

    function test_TransferRedeemableMovesHLCAndRedemptionCreditAtomically() public {
        address bob = makeAddr("bob");
        vm.prank(alice);
        psm.deposit(1_000e18);

        vm.startPrank(alice);
        token.approve(address(psm), 400e18);
        psm.transferRedeemable(bob, 400e18);
        vm.stopPrank();

        assertEq(token.balanceOf(alice), 600e18);
        assertEq(token.balanceOf(bob), 400e18);
        assertEq(psm.redeemableBalance(alice), 600e18);
        assertEq(psm.redeemableBalance(bob), 400e18);

        vm.startPrank(bob);
        token.approve(address(psm), 400e18);
        psm.withdraw(400e18);
        vm.stopPrank();
        assertEq(psm.redeemableBalance(bob), 0);
    }

    function test_CancelRedeemableBurnsHLCAndRetiresCredit() public {
        vm.prank(alice);
        psm.deposit(1_000e18);

        vm.startPrank(alice);
        token.approve(address(psm), 400e18);
        psm.cancelRedeemable(400e18);
        vm.stopPrank();

        assertEq(token.balanceOf(alice), 600e18);
        assertEq(psm.redeemableBalance(alice), 600e18);
        assertEq(psm.totalHlcIssued(), 600e18);
        assertEq(token.totalSupply(), 10_000_000e18 + 600e18);
        assertEq(psm.reserveSurplus(), 400e18);
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
