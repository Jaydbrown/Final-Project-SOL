// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILocalDAO {
    // ===== ENUMS =====
    enum Status { PENDING, ACTIVE, ENDED, INCOMPLETE }
    enum Category { HEALTH, EDUCATION, ENTERTAINMENT, AGRICULTURE, TECHNOLOGY, RETAIL, OTHER }
    enum Grade { A, B, C, D }

    // ===== STRUCTS =====
    struct User {
        address wallet;
        bool kycVerified;
        bytes32 kycProofHash;
        uint256 joinedAt;
        bool isActive;
    }

    struct Investment {
        uint256 id;
        string name;
        Status status;
        Category category;
        uint256 deadline;
        uint256 upvotes;
        uint256 downvotes;
        uint256 fundNeeded;
        uint256 expectedYield;
        Grade grade;
        string[] documentCIDs;
        uint256 totalYieldGenerated;
        uint256 totalYieldDistributed;
        uint256 extensionCount;
        uint256 createdAt;
        address createdBy;
    }

    struct Vote {
        address voter;
        uint256 investmentId;
        uint256 numberOfVotes;
        uint8 voteValue;
        uint256 timestamp;
        bool hasClaimedYield;
        uint256 yieldClaimed;
    }

    struct YieldDistribution {
        uint256 investmentId;
        uint256 totalAmount;
        uint256 distributedAmount;
        uint256 remainingAmount;
        string expenseReportCID;
        uint256 timestamp;
    }

    struct YieldProposal {
        uint256 id;
        uint256 investmentId;
        uint256 amount;
        string expenseReportCID;
        address proposer;
        uint256 approvals;
        bool executed;
        uint256 createdAt;
    }

    struct Activity {
        string eventType;
        uint256 timestamp;
        string details;
        string documentCID;
        address actor;
    }

    // ===== EVENTS =====
    event MemberAdded(address indexed member, uint256 timestamp);
    event MemberKYCVerified(address indexed member, uint256 timestamp);
    event MemberRemoved(address indexed member, uint256 timestamp);
    event MemberExited(address indexed member, uint256 timestamp);

    event InvestmentCreated(uint256 indexed investmentId, string name, uint256 fundNeeded, Grade grade, uint256 deadline);
    event InvestmentActivated(uint256 indexed investmentId, uint256 timestamp);
    event InvestmentClosed(uint256 indexed investmentId, uint256 timestamp);
    event InvestmentIncomplete(uint256 indexed investmentId, uint256 timestamp);
    event DeadlineExtended(uint256 indexed investmentId, uint256 newDeadline, uint256 extensionCount);

    event FundsLocked(uint256 indexed investmentId, uint256 amount);
    event FundsReleased(uint256 indexed investmentId, uint8 phase, uint256 amount, address indexed recipient);

    event VoteCast(uint256 indexed investmentId, address indexed voter, uint256 numberOfVotes, uint8 voteValue, uint256 timestamp);
    event StakeWithdrawn(uint256 indexed investmentId, address indexed voter, uint256 amount);

    event YieldDeposited(uint256 indexed investmentId, uint256 amount, string expenseReportCID, uint256 timestamp);
    event YieldClaimed(uint256 indexed investmentId, address indexed voter, uint256 amount, uint256 timestamp);
    event YieldDepositProposed(uint256 indexed proposalId, uint256 indexed investmentId, uint256 amount, address proposer, uint256 timestamp);
    event YieldDepositApproved(uint256 indexed proposalId, address indexed admin, uint256 approvals);
    event YieldDepositExecuted(uint256 indexed proposalId, uint256 indexed investmentId, uint256 amount, string expenseReportCID, uint256 timestamp);

    event ActivityLogged(uint256 indexed investmentId, string eventType, string details, uint256 timestamp);
    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);
    event FinanceManagerAdded(address indexed manager);
    event FinanceManagerRemoved(address indexed manager);
    event DAOPaused(uint256 timestamp);
    event DAOUnpaused(uint256 timestamp);
    event UnclaimedYieldRecovered(uint256 indexed investmentId, address indexed recipient, uint256 amount, uint256 timestamp);

    // ===== VIEW FUNCTIONS =====
    function name() external view returns (string memory);
    function location() external view returns (string memory);
    function creator() external view returns (address);
    function memberCount() external view returns (uint256);
    function investmentCount() external view returns (uint256);
    function activeInvestmentCount() external view returns (uint256);
    function totalValueLocked() external view returns (uint256);

    // Getters used by LocalDAOView
    function getInvestment(uint256 id) external view returns (Investment memory);
    function getVote(uint256 investmentId, address voter) external view returns (Vote memory);
    function getYieldDistribution(uint256 investmentId) external view returns (YieldDistribution memory);
    function getInvestmentTimeline(uint256 investmentId) external view returns (Activity[] memory);
    function getAllMembers() external view returns (address[] memory);

    // ===== STATE-CHANGING FUNCTIONS =====
    function pause() external;
    function unpause() external;
    function proposeYieldDeposit(uint256 investmentId, uint256 yieldAmount, string memory expenseReportCID) external returns (uint256);
    function approveYieldDeposit(uint256 proposalId) external;
    function executeYieldDeposit(uint256 proposalId) external;
}
