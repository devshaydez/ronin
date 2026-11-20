// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {IPayable} from "@reactive/src/interfaces/IPayable.sol";
import {AbstractCallback} from "@reactive/src/base/AbstractCallback.sol";

/// @title DecisionRequester
/// @notice Hop 1 of the AI loop. The Reactive contract detects something worth a second opinion
///         (rate spike, yield gap, scheduled re-score), computes features on Reactive Network, and
///         calls this contract. It emits DecisionRequested, which is what wakes the off-chain AI.
///         The AIVerdictRegistry only accepts verdicts that answer a request recorded here, so the
///         AI cannot push unsolicited ACT verdicts.
contract DecisionRequester is AbstractCallback {
    uint256 public count;
    mapping(uint256 => uint64) public requestedAt;
    mapping(uint256 => address) public requestPool;

    event DecisionRequested(
        uint256 indexed id,
        address indexed pool,
        uint256 rateBps,
        uint256 emaBps,
        uint256 utilBps,
        uint256 gapBps,
        uint256 riskScore,
        uint8 trigger // 1 = rate spike, 2 = yield gap, 3 = scheduled (CRON)
    );

    constructor(IPayable callbackProxy_, address callbackSender_)
        payable
        AbstractCallback(callbackProxy_, callbackSender_)
    {}

    function requestDecision(
        address reactive_,
        address pool,
        uint256 rateBps,
        uint256 emaBps,
        uint256 utilBps,
        uint256 gapBps,
        uint256 riskScore,
        uint8 trigger
    ) external onlyServiceProvider onlyCallbackSender(reactive_) {
        uint256 id = ++count;
        requestedAt[id] = uint64(block.timestamp);
        requestPool[id] = pool;
        emit DecisionRequested(id, pool, rateBps, emaBps, utilBps, gapBps, riskScore, trigger);
    }

    function coverDebt() external {
        _coverDebt();
    }
}
