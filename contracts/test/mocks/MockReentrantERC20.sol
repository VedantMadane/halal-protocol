// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IReserveAdminTarget {
    function withdrawReserve(address to, uint256 amount) external;
}

/// @notice Test-only reserve token that calls back into the PSM during an outgoing transfer.
contract MockReentrantERC20 is ERC20 {
    address public target;
    address public reentryRecipient;
    uint256 public reentryAmount;
    bool public reenterOnOutgoingTransfer;

    constructor() ERC20("Reentrant DAI", "rDAI") { }

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function configureReentry(address target_, address recipient_, uint256 amount_) external {
        target = target_;
        reentryRecipient = recipient_;
        reentryAmount = amount_;
        reenterOnOutgoingTransfer = true;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from == target && reenterOnOutgoingTransfer) {
            reenterOnOutgoingTransfer = false;
            IReserveAdminTarget(target).withdrawReserve(reentryRecipient, reentryAmount);
        }
        super._update(from, to, value);
    }
}
