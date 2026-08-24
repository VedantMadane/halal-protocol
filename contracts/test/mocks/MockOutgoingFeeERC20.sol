// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Test-only token that debits an extra fee from the sender on transfers.
/// @dev This models reserve tokens that burn or divert more than the nominal amount.
contract MockOutgoingFeeERC20 is ERC20 {
    uint256 public immutable feeBps;
    address public immutable feeCollector;

    constructor(uint256 feeBps_) ERC20("Outgoing Fee DAI", "oDAI") {
        feeBps = feeBps_;
        feeCollector = address(0xfee);
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0) && feeBps != 0) {
            uint256 fee = (value * feeBps) / 10_000;
            super._update(from, feeCollector, fee);
            super._update(from, to, value);
        } else {
            super._update(from, to, value);
        }
    }
}
