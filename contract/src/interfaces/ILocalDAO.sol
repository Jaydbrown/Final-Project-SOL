// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ILocalDAO
 * @notice Interface for LocalDAO contract
 * @dev Used by Factory for standardized DAO interactions
 */
interface ILocalDAO {
    // Enums
    enum Status { PENDING, ACTIVE, ENDED, INCOMPLETE }
    enum Category { HEALTH, EDUCATION, ENTERTAINMENT, AGRICULTURE, TECHNOLOGY, RETAIL, OTHER }
    enum Grade { A, B, C, D }

    // View functions
    function name() external view returns (string memory);
    function location() external view returns (string memory);
    function creator() external view returns (address);
    function memberCount() external view returns (uint256);
    function investmentCount() external view returns (uint256);
    function activeInvestmentCount() external view returns (uint256);
    function totalValueLocked() external view returns (uint256);
    
    // State-changing functions
    function pause() external;
    function unpause() external;

    // Yield multisig functions
    function depositYield(uint256 investmentId, uint256 yieldAmount, string memory expenseReportCID) external;
    function proposeYieldDeposit(uint256 investmentId, uint256 yieldAmount, string memory expenseReportCID) external returns (uint256);
    function approveYieldDeposit(uint256 proposalId) external;
    function executeYieldDeposit(uint256 proposalId) external;

    // Analytics helpers
    function getInvestmentAnalytics(uint256 investmentId)
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
        );

    function getUserAnalytics(address user)
        external
        view
        returns (
            uint256 totalStaked,
            uint256 totalClaimedYield,
            uint256 totalClaimableYield,
            uint256 realizedRoiBps
        );
}
