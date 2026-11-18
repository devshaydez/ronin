// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IAaveV3Pool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}

/// @title AaveV3Adapter
/// @notice Presents ONE Aave V3 reserve to the vault through the same ILendingPool surface as the mock pools
///         (deposit / withdraw / balanceOf / rateBps / utilizationBps). It keeps the aTokens itself and tracks each
///         depositor with shares, so the vault's balance grows as Aave interest accrues.
///
///         Rates and token addresses come from `getReserveData(asset)`. That struct is all fixed-size words, so we
///         read the words we need by position instead of depending on the exact struct type, which changed between
///         Aave versions:
///           word 2  = currentLiquidityRate (ray, 1e27 = 100% APR)
///           word 8  = aTokenAddress
///           word 9  = stableDebtTokenAddress (may be zero or absent on newer versions)
///           word 10 = variableDebtTokenAddress
///         Check `rateBps()` against the Aave UI after deploying (see README).
contract AaveV3Adapter {
    using SafeERC20 for IERC20;

    IAaveV3Pool public immutable aavePool;
    IERC20 public immutable asset;
    string public name;

    uint256 public totalShares;
    mapping(address => uint256) public shares;

    constructor(address aavePool_, IERC20 asset_, string memory name_) {
        aavePool = IAaveV3Pool(aavePool_);
        asset = asset_;
        name = name_;
    }

    // ───────────── ILendingPool surface ─────────────

    function deposit(uint256 amount) external {
        (, address aToken,,) = _reserve();
        uint256 aBal = IERC20(aToken).balanceOf(address(this));
        asset.safeTransferFrom(msg.sender, address(this), amount);

        uint256 minted = (totalShares == 0 || aBal == 0) ? amount : (amount * totalShares) / aBal;
        require(minted > 0, "zero shares");
        shares[msg.sender] += minted;
        totalShares += minted;

        asset.forceApprove(address(aavePool), amount);
        aavePool.supply(address(asset), amount, address(this), 0);
    }

    function withdraw(uint256 amount) external {
        (, address aToken,,) = _reserve();
        uint256 aBal = IERC20(aToken).balanceOf(address(this));
        require(aBal > 0, "empty");
        uint256 burn = (amount * totalShares + aBal - 1) / aBal; // round up: the withdrawer pays the rounding
        require(shares[msg.sender] >= burn, "insufficient balance");
        shares[msg.sender] -= burn;
        totalShares -= burn;

        uint256 got = aavePool.withdraw(address(asset), amount, msg.sender);
        require(got >= amount, "short withdraw");
    }

    function balanceOf(address account) external view returns (uint256) {
        if (totalShares == 0) return 0;
        (, address aToken,,) = _reserve();
        return (IERC20(aToken).balanceOf(address(this)) * shares[account]) / totalShares;
    }

    /// @return supply APR in basis points (Aave liquidityRate is ray: 1e27 = 100%, so /1e23 gives bps)
    function rateBps() external view returns (uint256) {
        (uint256 liquidityRate,,,) = _reserve();
        return liquidityRate / 1e23;
    }

    /// @return utilisation in basis points: total debt / (debt + available liquidity)
    function utilizationBps() external view returns (uint256) {
        (, address aToken, address stableDebt, address varDebt) = _reserve();
        uint256 debt = _totalSupply(stableDebt) + _totalSupply(varDebt);
        uint256 liquidity = asset.balanceOf(aToken);
        if (debt + liquidity == 0) return 0;
        return (debt * 10_000) / (debt + liquidity);
    }

    // ───────────── internals ─────────────

    function _reserve()
        internal
        view
        returns (uint256 liquidityRate, address aToken, address stableDebt, address varDebt)
    {
        (bool ok, bytes memory ret) =
            address(aavePool).staticcall(abi.encodeWithSignature("getReserveData(address)", address(asset)));
        require(ok && ret.length >= 32 * 11, "reserve data");
        uint256 w2;
        uint256 w8;
        uint256 w9;
        uint256 w10;
        assembly {
            w2 := mload(add(ret, 96)) // 32 (length prefix) + 2 * 32
            w8 := mload(add(ret, 288)) // 32 + 8 * 32
            w9 := mload(add(ret, 320))
            w10 := mload(add(ret, 352))
        }
        liquidityRate = w2;
        aToken = address(uint160(w8));
        stableDebt = address(uint160(w9));
        varDebt = address(uint160(w10));
    }

    function _totalSupply(address token) internal view returns (uint256) {
        if (token == address(0)) return 0;
        (bool ok, bytes memory r) = token.staticcall(abi.encodeWithSignature("totalSupply()"));
        if (!ok || r.length < 32) return 0;
        return abi.decode(r, (uint256));
    }
}
