// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Minimal lending pool for the demo. Principal-only accounting; the owner drives
///         the advertised rate and utilization, which is what the Reactive contract watches.
contract MockLendingPool is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable asset;
    string public name;
    uint256 public rateBps; // advertised supply APY in basis points
    uint256 public utilizationBps; // 0..10000

    mapping(address => uint256) private _balances;

    event RateUpdated(address indexed pool, uint256 rateBps, uint256 utilizationBps);
    event Deposited(address indexed account, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);
    event YieldAccrued(address indexed account, uint256 amount);

    constructor(IERC20 asset_, string memory name_, uint256 rate_, uint256 util_, address owner_) Ownable(owner_) {
        asset = asset_;
        name = name_;
        rateBps = rate_;
        utilizationBps = util_;
    }

    function setRate(uint256 rate_, uint256 util_) external onlyOwner {
        require(util_ <= 10_000, "util > 100%");
        rateBps = rate_;
        utilizationBps = util_;
        emit RateUpdated(address(this), rate_, util_);
    }

    function deposit(uint256 amount) external {
        asset.safeTransferFrom(msg.sender, address(this), amount);
        _balances[msg.sender] += amount;
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        require(_balances[msg.sender] >= amount, "insufficient balance");
        _balances[msg.sender] -= amount;
        asset.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    /// @notice Test/demo helper: credit `account` with yield. The caller must have funded the pool
    ///         (mint the token to this address) so the extra balance is actually withdrawable.
    function accrue(address account, uint256 amount) external {
        _balances[account] += amount;
        emit YieldAccrued(account, amount);
    }
}
