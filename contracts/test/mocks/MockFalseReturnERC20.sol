// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/// @notice Test-only reserve token that returns false from both transfer paths without reverting.
/// SafeERC20 must reject it instead of treating the call as a successful reserve movement.
contract MockFalseReturnERC20 is IERC20Metadata {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint256 public totalSupply;

    function name() external pure returns (string memory) {
        return "False Reserve";
    }

    function symbol() external pure returns (string memory) {
        return "fRES";
    }

    function decimals() external pure returns (uint8) {
        return 18;
    }

    function transfer(address, uint256) external pure returns (bool) {
        return false;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address, address, uint256) external pure returns (bool) {
        return false;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }
}
