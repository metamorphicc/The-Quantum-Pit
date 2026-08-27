// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract QuantumPitDonations {
    address public owner;

    event DonationETH(address indexed from, uint256 amount, bytes32 indexed ref);
    event DonationERC20(address indexed from, address indexed token, uint256 amount, bytes32 ref);
    event Withdraw(address indexed to, uint256 amount);
    event WithdrawERC20(address indexed token, address indexed to, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error ZeroAmount();
    error ZeroAddress();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address owner_) {
        owner = owner_ == address(0) ? msg.sender : owner_;
        emit OwnershipTransferred(address(0), owner);
    }

    /// @notice Donate native ETH, tagged with a ref you can map to a user.
    function donate(bytes32 ref) external payable {
        if (msg.value == 0) revert ZeroAmount();
        emit DonationETH(msg.sender, msg.value, ref);
    }

    /// @notice Donate an ERC-20 (e.g. USDC). Caller must approve() first.
    function donateERC20(address token, uint256 amount, bytes32 ref) external {
        if (amount == 0) revert ZeroAmount();
        if (!IERC20(token).transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        emit DonationERC20(msg.sender, token, amount, ref);
    }

    /// @notice Withdraw collected ETH to `to`.
    function withdraw(address payable to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Withdraw(to, amount);
    }

    /// @notice Withdraw collected ERC-20 tokens to `to`.
    function withdrawERC20(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (!IERC20(token).transfer(to, amount)) revert TransferFailed();
        emit WithdrawERC20(token, to, amount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Bare ETH sends are treated as an untagged donation.
    receive() external payable {
        emit DonationETH(msg.sender, msg.value, bytes32(0));
    }
}
