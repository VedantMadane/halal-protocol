// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { HalalPSM } from "../src/HalalPSM.sol";
import { MockERC20 } from "./mocks/MockERC20.sol";

/// @notice Differential checks for the PSM's decimal-normalization and CPI arithmetic.
/// The reference formulas intentionally live outside HalalPSM so a shared implementation mistake
/// cannot make both the contract and its expected values agree.
contract HalalPSMArithmeticTest is Test {
    function testFuzz_PreviewDepositMatchesReference(uint256 decimalsSeed, uint256 amountSeed, uint256 cpiSeed) public {
        uint256 decimals = bound(decimalsSeed, 0, 77);
        uint256 cpi = bound(cpiSeed, 100_000, 2_000_000);
        uint256 amount = bound(amountSeed, 0, _maxDepositAmount(decimals, cpi));
        HalalPSM target = _newPsm(decimals);

        target.mockCPI(cpi);

        assertEq(target.previewDeposit(amount), _referenceDeposit(amount, decimals, cpi));
    }

    function testFuzz_PreviewWithdrawMatchesReference(uint256 decimalsSeed, uint256 amountSeed, uint256 cpiSeed)
        public
    {
        uint256 decimals = bound(decimalsSeed, 0, 77);
        uint256 cpi = bound(cpiSeed, 100_000, 2_000_000);
        uint256 amount = bound(amountSeed, 0, _maxWithdrawAmount(decimals, cpi));
        HalalPSM target = _newPsm(decimals);

        target.mockCPI(cpi);

        assertEq(target.previewWithdraw(amount), _referenceWithdraw(amount, decimals, cpi));
    }

    function _newPsm(uint256 decimals) internal returns (HalalPSM) {
        // forge-lint: disable-next-line(unsafe-typecast)
        MockERC20 reserve = new MockERC20("Arithmetic Reserve", "aRES", uint8(decimals));
        MockERC20 hlc = new MockERC20("Arithmetic HLC", "aHLC", 18);
        return new HalalPSM(address(reserve), address(hlc), address(this), address(0));
    }

    function _referenceDeposit(uint256 amount, uint256 decimals, uint256 cpi) internal pure returns (uint256) {
        if (decimals < 18) {
            return Math.mulDiv(amount, (10 ** (18 - decimals)) * 1_000_000, cpi);
        }
        return Math.mulDiv(amount, 1_000_000, cpi * (10 ** (decimals - 18)));
    }

    function _referenceWithdraw(uint256 amount, uint256 decimals, uint256 cpi) internal pure returns (uint256) {
        if (decimals < 18) {
            return Math.mulDiv(amount, cpi, 1_000_000 * (10 ** (18 - decimals)));
        }
        return Math.mulDiv(amount, cpi * (10 ** (decimals - 18)), 1_000_000);
    }

    function _maxDepositAmount(uint256 decimals, uint256 cpi) internal pure returns (uint256) {
        if (decimals < 18) {
            return _maxInputForOutput((10 ** (18 - decimals)) * 1_000_000, cpi);
        }
        return _maxInputForOutput(1_000_000, cpi * (10 ** (decimals - 18)));
    }

    function _maxWithdrawAmount(uint256 decimals, uint256 cpi) internal pure returns (uint256) {
        if (decimals < 18) {
            return _maxInputForOutput(cpi, 1_000_000 * (10 ** (18 - decimals)));
        }
        return _maxInputForOutput(cpi * (10 ** (decimals - 18)), 1_000_000);
    }

    function _maxInputForOutput(uint256 numerator, uint256 denominator) internal pure returns (uint256) {
        if (numerator <= denominator) return type(uint256).max;
        return Math.mulDiv(type(uint256).max, denominator, numerator);
    }
}
