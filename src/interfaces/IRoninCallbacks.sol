// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

/// @notice Callback surfaces on the destination chains. The Reactive contract builds payloads with
///         abi.encodeCall against these, so a signature typo is a compile error, not a silent failure.
///         The first argument of every callback is replaced by Reactive Network with the RSC address.
interface IVaultCallbacks {
    function rebalance(address reactive_, uint256 verdictId, address toPool) external;
    function pauseByVerdict(address reactive_, uint256 verdictId) external;
    function emergencyExit(address reactive_, address pool) external;
    function pauseByReactive(address reactive_, bytes32 reason) external;
    function unpauseByReactive(address reactive_, bytes32 reason) external;
    function updateOmniSignal(
        address reactive_,
        uint256 localBestBps,
        uint256 globalBestBps,
        uint256 globalBestChainId
    ) external;
    function executePlan(address reactive_, uint256 id) external;
}

interface IRequesterCallbacks {
    function requestDecision(
        address reactive_,
        address pool,
        uint256 rateBps,
        uint256 emaBps,
        uint256 utilBps,
        uint256 gapBps,
        uint256 riskScore,
        uint8 trigger
    ) external;
}
