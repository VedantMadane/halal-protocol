// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { MockERC20 } from "./MockERC20.sol";

/// @notice Test-only reserve token whose issuer can freeze transfers.
contract MockPausableERC20 is MockERC20 {
    bool public paused;

    error TransfersPaused();

    constructor() MockERC20("Pausable DAI", "pDAI", 18) { }

    function setPaused(bool value) external {
        paused = value;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (paused && from != address(0) && to != address(0)) revert TransfersPaused();
        super._update(from, to, value);
    }
}
