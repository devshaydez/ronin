// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {IAIVerdictRegistry} from "./interfaces/IAIVerdictRegistry.sol";
import {IDecisionRequester} from "./interfaces/IDecisionRequester.sol";

/// @notice On-chain audit trail of the AI's decisions. Hop 2 of the AI loop: the AI answers a
///         DecisionRequested by posting a verdict here, which the Reactive contract picks up.
///         A verdict is only accepted if it answers a real, still-unanswered Reactive request.
contract AIVerdictRegistry is IAIVerdictRegistry {
    uint8 public constant ACT = 1;
    uint8 public constant IGNORE = 2;
    uint8 public constant PAUSE = 3;

    address public immutable poster;
    IDecisionRequester public immutable requester;
    uint256 public count;

    mapping(uint256 => Verdict) private _verdicts;
    mapping(uint256 => bool) public answered; // requestId => answered

    event VerdictPosted(
        uint256 indexed id,
        address indexed targetPool,
        uint8 action,
        uint16 confidenceBps,
        bytes32 reasoningHash,
        uint256 requestId
    );
    event VerdictReasoning(uint256 indexed id, string reasoning);

    constructor(address poster_, IDecisionRequester requester_) {
        poster = poster_;
        requester = requester_;
    }

    function postVerdict(
        uint256 requestId,
        uint8 action,
        uint16 confidenceBps,
        address targetPool,
        bytes32 reasoningHash,
        string calldata reasoning
    ) external returns (uint256 id) {
        require(msg.sender == poster, "only poster");
        require(requester.requestedAt(requestId) != 0, "unknown request");
        require(!answered[requestId], "already answered");
        require(action >= ACT && action <= PAUSE, "bad action");
        require(confidenceBps <= 10_000, "bad confidence");
        require(reasoningHash == keccak256(bytes(reasoning)), "hash mismatch");

        answered[requestId] = true;
        id = ++count;
        _verdicts[id] = Verdict({
            action: action,
            confidenceBps: confidenceBps,
            targetPool: targetPool,
            reasoningHash: reasoningHash,
            timestamp: uint64(block.timestamp),
            requestId: requestId
        });

        emit VerdictPosted(id, targetPool, action, confidenceBps, reasoningHash, requestId);
        emit VerdictReasoning(id, reasoning);
    }

    function getVerdict(uint256 id) external view returns (Verdict memory) {
        return _verdicts[id];
    }
}
