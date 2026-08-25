// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Test-only ERC20-shaped reserve token whose transfer functions return no data.
/// @dev SafeERC20 intentionally accepts this widely deployed legacy token behavior.
contract MockNoReturnERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint256 public totalSupply;

    function name() external pure returns (string memory) {
        return "No Return Reserve";
    }

    function symbol() external pure returns (string memory) {
        return "nrRES";
    }

    function decimals() external pure returns (uint8) {
        return 18;
    }

    function approve(address spender, uint256 amount) external {
        allowance[msg.sender][spender] = amount;
    }

    function transfer(address to, uint256 amount) external {
        _move(msg.sender, to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) external {
        uint256 permitted = allowance[from][msg.sender];
        require(permitted >= amount, "allowance");
        if (permitted != type(uint256).max) allowance[from][msg.sender] = permitted - amount;
        _move(from, to, amount);
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function _move(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
    }
}
