// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ILocalDAO} from "./interfaces/ILocalDAO.sol";
import {YieldCalculator} from "./libraries/YieldCalculator.sol";
import {InvestmentManager} from "./libraries/InvestmentManager.sol";

/**
 * @title LocalDAOView
 * @notice Read-only lens contract for LocalDAO analytics and bulk queries.
 * @dev Deploy once; pass any LocalDAO clone address to each function.
 *      These functions were extracted from LocalDAO to keep it under EIP-170's 24,576-byte limit.
 */
contract LocalDAOView {
    function getAllInvestments(address dao)
        external
        view
        returns (ILocalDAO.Investment[] memory)
    {
        uint256 count = ILocalDAO(dao).investmentCount();
        ILocalDAO.Investment[] memory all = new ILocalDAO.Investment[](count);
        for (uint256 i = 1; i <= count; i++) {
            all[i - 1] = ILocalDAO(dao).getInvestment(i);
        }
        return all;
    }

    function getInvestmentsByStatus(address dao, ILocalDAO.Status status)
        external
        view
        returns (ILocalDAO.Investment[] memory)
    {
        uint256 total = ILocalDAO(dao).investmentCount();
        uint256 count = 0;
        for (uint256 i = 1; i <= total; i++) {
            if (ILocalDAO(dao).getInvestment(i).status == status) count++;
        }

        ILocalDAO.Investment[] memory result = new ILocalDAO.Investment[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= total; i++) {
            ILocalDAO.Investment memory inv = ILocalDAO(dao).getInvestment(i);
            if (inv.status == status) {
                result[index] = inv;
                index++;
            }
        }
        return result;
    }

    function getInvestmentAnalytics(address dao, uint256 investmentId)
        external
        view
        returns (
            uint256 principal,
            uint256 totalStaked,
            uint256 expectedYieldAmount,
            uint256 totalYieldGenerated,
            uint256 totalYieldDistributed,
            uint256 remainingYield,
            uint256 realizedRoiBps,
            uint256 expectedRoiBps,
            uint256 stakingUtilizationBps
        )
    {
        ILocalDAO.Investment memory inv = ILocalDAO(dao).getInvestment(investmentId);
        ILocalDAO.YieldDistribution memory dist = ILocalDAO(dao).getYieldDistribution(investmentId);

        principal = inv.fundNeeded;
        totalStaked = inv.upvotes;
        expectedYieldAmount = YieldCalculator.calculateExpectedYield(inv.fundNeeded, inv.expectedYield);
        totalYieldGenerated = inv.totalYieldGenerated;
        totalYieldDistributed = inv.totalYieldDistributed;
        remainingYield = dist.remainingAmount;

        realizedRoiBps = principal == 0 ? 0 : YieldCalculator.calculateYieldPercentage(totalYieldGenerated, principal);
        expectedRoiBps = principal == 0 ? 0 : YieldCalculator.calculateYieldPercentage(expectedYieldAmount, principal);
        stakingUtilizationBps = principal == 0 ? 0 : (totalStaked * 10000) / principal;
    }

    function getUserAnalytics(address dao, address user)
        external
        view
        returns (
            uint256 totalStaked,
            uint256 totalClaimedYield,
            uint256 totalClaimableYield,
            uint256 realizedRoiBps
        )
    {
        uint256 count = ILocalDAO(dao).investmentCount();
        for (uint256 i = 1; i <= count; i++) {
            ILocalDAO.Vote memory userVote = ILocalDAO(dao).getVote(i, user);
            if (userVote.numberOfVotes == 0 || userVote.voteValue != 1) continue;

            totalStaked += userVote.numberOfVotes;
            totalClaimedYield += userVote.yieldClaimed;

            if (!userVote.hasClaimedYield) {
                ILocalDAO.Investment memory inv = ILocalDAO(dao).getInvestment(i);
                if (inv.status == ILocalDAO.Status.ACTIVE) {
                    totalClaimableYield += YieldCalculator.calculateUserYield(
                        userVote.numberOfVotes,
                        inv.upvotes,
                        inv.totalYieldGenerated
                    );
                }
            }
        }

        realizedRoiBps = totalStaked == 0
            ? 0
            : YieldCalculator.calculateYieldPercentage(totalClaimedYield, totalStaked);
    }

    function calculateClaimableYield(address dao, uint256 investmentId, address voter)
        external
        view
        returns (uint256)
    {
        ILocalDAO.Investment memory inv = ILocalDAO(dao).getInvestment(investmentId);
        if (inv.status != ILocalDAO.Status.ACTIVE) return 0;

        ILocalDAO.Vote memory userVote = ILocalDAO(dao).getVote(investmentId, voter);
        if (userVote.numberOfVotes == 0 || userVote.voteValue != 1 || userVote.hasClaimedYield) return 0;

        return YieldCalculator.calculateUserYield(
            userVote.numberOfVotes,
            inv.upvotes,
            inv.totalYieldGenerated
        );
    }

    function canActivateInvestment(address dao, uint256 investmentId) external view returns (bool) {
        ILocalDAO.Investment memory inv = ILocalDAO(dao).getInvestment(investmentId);
        return InvestmentManager.canActivate(inv.upvotes, inv.fundNeeded, inv.deadline, block.timestamp);
    }
}
