// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {YieldCalculator} from "./libraries/YieldCalculator.sol";
import {InvestmentManager} from "./libraries/InvestmentManager.sol";
import {StringUtils} from "./libraries/StringUtils.sol";
import {ILocalDAO} from "./interfaces/ILocalDAO.sol";

/**
 * @title LocalDAO
 * @notice Core DAO contract for governance, investments, and treasury management
 * @dev Implements ILocalDAO interface for standardized interactions
 * @dev Uses SafeERC20 for secure token transfers
 * @dev Deployed as EIP-1167 minimal proxy clones from LocalDAOFactory
 */
contract LocalDAO is ILocalDAO, Pausable, ReentrancyGuard, Initializable {
    using SafeERC20 for IERC20;

    // Custom errors (save ~40 bytes each vs string requires)
    error InvalidInvestment();
    error NotPending();
    error DeadlinePassed();
    error InvalidVoteValue();
    error UpvoteRequiresStake();
    error InsufficientBalance();
    error InsufficientAllowance();
    error CannotChangeDownToUp();
    error AlreadyVoted();
    error DownvoteNoStake();

    // ===== ENUMS =====
    // Using enums from ILocalDAO interface

    // ===== DAO IDENTITY =====
    string public name;
    string public description;
    string public location;
    string public coordinates;
    string public postalCode;
    string public logoURI;
    uint256 public maxMembership;

    // ===== ROLES =====
    address public creator;
    address[] public admins;
    mapping(address => bool) public isAdmin;
    mapping(address => bool) public isFinanceManager;

    // ===== MEMBERS =====
    struct User {
        address wallet;
        bool kycVerified;
        bytes32 kycProofHash;
        uint256 joinedAt;
        bool isActive;
    }
    mapping(address => User) public members;
    address[] public memberAddresses;
    uint256 public memberCount;

    // ===== INVESTMENTS =====
    struct Investment {
        uint256 id;
        string name;
        ILocalDAO.Status status;
        ILocalDAO.Category category;
        uint256 deadline;
        uint256 upvotes;
        uint256 downvotes;
        uint256 fundNeeded;
        uint256 expectedYield;
        ILocalDAO.Grade grade;
        string[] documentCIDs;
        uint256 totalYieldGenerated;
        uint256 totalYieldDistributed;
        uint256 extensionCount;
        uint256 createdAt;
        address createdBy;
    }
    mapping(uint256 => Investment) public investments;
    uint256 public investmentCount;
    uint256 public activeInvestmentCount;

    // ===== VOTING =====
    struct Vote {
        address voter;
        uint256 investmentId;
        uint256 numberOfVotes;
        uint8 voteValue; // 1 = upvote, 0 = downvote
        uint256 timestamp;
        bool hasClaimedYield;
        uint256 yieldClaimed;
    }
    mapping(uint256 => mapping(address => Vote)) public votes;

    // ===== YIELD TRACKING =====
    struct YieldDistribution {
        uint256 investmentId;
        uint256 totalAmount;
        uint256 distributedAmount;
        uint256 remainingAmount;
        string expenseReportCID;
        uint256 timestamp;
    }
    mapping(uint256 => YieldDistribution) public yieldDistributions;

    // ===== YIELD PROPOSALS (MULTI-SIG) =====
    uint256 public constant REQUIRED_YIELD_APPROVALS = 3; // 3 of 5 admins
    uint256 public constant REQUIRED_ADMIN_COUNT = 5; // Ensure DAO has at least 5 admins for the 3/5 rule

    struct YieldProposal {
        uint256 id;
        uint256 investmentId;
        uint256 amount;
        string expenseReportCID;
        address proposer; // finance manager who proposed
        uint256 approvals;
        bool executed;
        uint256 createdAt;
    }

    uint256 public yieldProposalCount;
    mapping(uint256 => YieldProposal) public yieldProposals;
    // proposalId => admin => approved
    mapping(uint256 => mapping(address => bool)) public yieldProposalApprovals;

    // ===== ACTIVITY TIMELINE =====
    struct Activity {
        string eventType;
        uint256 timestamp;
        string details;
        string documentCID;
        address actor;
    }
    mapping(uint256 => Activity[]) public investmentTimeline;

    // ===== TREASURY =====
    address public usdcAddress;
    uint256 public totalValueLocked;

    // ===== ESCROW / LOCKING =====
    // Escrowed funds per investment (amount reserved for that investment)
    mapping(uint256 => uint256) public escrowedAmount;
    // Original escrow totals (used for percent calculations)
    mapping(uint256 => uint256) public escrowTotal;
    // Track which phase has been released: 0 = none, 1 = phase1, 2 = phase2, 3 = all
    mapping(uint256 => uint8) public releasePhaseCompleted;

    uint256 public constant PHASE1_PERCENT = 30;
    uint256 public constant PHASE2_PERCENT = 40;
    uint256 public constant PHASE3_PERCENT = 30;

    // ===== CONSTANTS =====
    uint256 public constant MAX_EXTENSIONS = 3;
    uint256 public constant GRACE_PERIOD_FOR_UNCLAIMED_YIELD = 90 days; // 90 days grace period before recovery

    // ===== MODIFIERS =====
    modifier onlyCreator() {
        require(msg.sender == creator, "Not creator");
        _;
    }

    modifier onlyAdmin() {
        require(isAdmin[msg.sender] || msg.sender == creator, "Not admin");
        _;
    }

    modifier onlyFinanceManager() {
        require(
            isFinanceManager[msg.sender] || 
            isAdmin[msg.sender] || 
            msg.sender == creator,
            "Not authorized"
        );
        _;
    }

    modifier onlyVerifiedMember() {
        require(members[msg.sender].isActive, "Not active member");
        require(members[msg.sender].kycVerified, "KYC not verified");
        _;
    }

    /**
     * @notice Modifier to check if user has stake in an investment (for yield claiming)
     * @dev Allows former members to claim yield if they have stake
     */
    modifier hasStakeInInvestment(uint256 investmentId) {
        Vote storage userVote = votes[investmentId][msg.sender];
        require(userVote.numberOfVotes > 0, "No stake in investment");
        require(userVote.voteValue == 1, "Only upvoters can claim yield");
        _;
    }

    modifier investmentExists(uint256 investmentId) {
        if (investmentId == 0 || investmentId > investmentCount) revert InvalidInvestment();
        _;
    }

    // ===== CONSTRUCTOR / INITIALIZER =====
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the LocalDAO (called by factory when deploying clone)
     * @param _creator DAO creator address
     * @param _name DAO name
     * @param _description DAO mission statement
     * @param _location Geographic location
     * @param _coordinates GPS coordinates
     * @param _postalCode Postal/ZIP code
     * @param _maxMembership Maximum members allowed
     * @param _usdcAddress USDC token address
     */
    function initialize(
        address _creator,
        string memory _name,
        string memory _description,
        string memory _location,
        string memory _coordinates,
        string memory _postalCode,
        uint256 _maxMembership,
        address _usdcAddress
    ) external initializer {
        require(_creator != address(0), "Invalid creator");
        require(_usdcAddress != address(0), "Invalid USDC address");

        creator = _creator;
        name = _name;
        description = _description;
        location = _location;
        coordinates = _coordinates;
        postalCode = _postalCode;
        maxMembership = _maxMembership;
        usdcAddress = _usdcAddress;
    }

    // ===== MEMBER MANAGEMENT =====
    /**
     * @notice Add a new member to the DAO
     * @dev Only admins can add members. KYC verification happens separately via verifyMemberKYC
     * @dev Off-chain: Admin should verify KYC documents before calling verifyMemberKYC
     * @param wallet Address of the new member
     * @param kycProofHash Hash of KYC proof document (stored off-chain, verified by admin)
     */
    function addMember(address wallet, bytes32 kycProofHash) 
        external 
        onlyAdmin 
        whenNotPaused 
    {
        require(wallet != address(0), "LocalDAO: Invalid wallet address");
        require(!members[wallet].isActive, "LocalDAO: Address is already a member");
        require(memberCount < maxMembership, "LocalDAO: Maximum membership limit reached");

        members[wallet] = User({
            wallet: wallet,
            kycVerified: true,
            kycProofHash: kycProofHash,
            joinedAt: block.timestamp,
            isActive: true
        });
        memberAddresses.push(wallet);
        memberCount++;

        emit MemberAdded(wallet, block.timestamp);
    }

    /**
     * @notice Verify a member's KYC status
     * @dev Only admins can verify KYC. Admin must verify KYC documents off-chain before calling this
     * @dev Off-chain: Admin should compare kycProofHash with submitted documents before verification
     * @param wallet Address of the member to verify
     */
    function verifyMemberKYC(address wallet) external onlyAdmin whenNotPaused {
        require(members[wallet].isActive, "LocalDAO: Address is not a member");
        require(!members[wallet].kycVerified, "LocalDAO: Member KYC already verified");

        members[wallet].kycVerified = true;
        emit MemberKYCVerified(wallet, block.timestamp);
    }

    /**
     * @notice Remove a member from the DAO
     * @dev Admin function. Removed members can still claim yield if they have stake
     * @param wallet Address of the member to remove
     */
    function removeMember(address wallet) external onlyAdmin whenNotPaused {
        require(members[wallet].isActive, "LocalDAO: Address is not a member");

        members[wallet].isActive = false;
        memberCount--;

        emit MemberRemoved(wallet, block.timestamp);
    }

    /**
     * @notice Allow a member to exit the DAO voluntarily
     * @dev Members can exit even with active stakes. They can still claim yield later
     * @dev Warning: Exiting members lose voting rights but retain yield claim rights
     */
    function exitDAO() external whenNotPaused {
        require(members[msg.sender].isActive, "LocalDAO: Not a member");
        
        members[msg.sender].isActive = false;
        memberCount--;

        emit MemberExited(msg.sender, block.timestamp);
    }

    function getAllMembers() external view returns (address[] memory) {
        return memberAddresses;
    }

    function isVerifiedMember(address wallet) external view returns (bool) {
        return members[wallet].isActive && members[wallet].kycVerified;
    }

    // ===== INVESTMENT CREATION =====
    /**
     * @notice Create a new investment proposal
     * @dev Only admins can create investments. Members vote to approve funding
     * @param _name Name of the investment proposal
     * @param category Investment category (HEALTH, EDUCATION, etc.)
     * @param fundNeeded Required funding amount in USDC (must be > 0)
     * @param expectedYield Expected yield percentage (0-100, e.g., 5 = 5%)
     * @param grade Investment grade (A, B, C, or D) - affects extension eligibility
     * @param deadline Voting deadline in days (1-365 days)
     * @param documentCIDs Array of IPFS/document CIDs for proposal documents
     * @return investmentId The ID of the newly created investment
     */
    function createInvestment(
        string memory _name,
        ILocalDAO.Category category,
        uint256 fundNeeded,
        uint256 expectedYield,
        ILocalDAO.Grade grade,
        uint256 deadline,
        string[] memory documentCIDs
    ) external onlyAdmin whenNotPaused returns (uint256 investmentId) {
        require(
            InvestmentManager.validateInvestmentParams(fundNeeded, expectedYield, deadline),
            "LocalDAO: Invalid investment parameters"
        );
        require(bytes(_name).length > 0, "LocalDAO: Investment name cannot be empty");

        investmentCount++;
        investmentId = investmentCount;

        investments[investmentId] = Investment({
            id: investmentId,
            name: _name,
            status: ILocalDAO.Status.PENDING,
            category: category,
            deadline: block.timestamp + (deadline * 1 days),
            upvotes: 0,
            downvotes: 0,
            fundNeeded: fundNeeded,
            expectedYield: expectedYield,
            grade: grade,
            documentCIDs: documentCIDs,
            totalYieldGenerated: 0,
            totalYieldDistributed: 0,
            extensionCount: 0,
            createdAt: block.timestamp,
            createdBy: msg.sender
        });

        _addActivity(
            investmentId,
            "investment_created",
            "Investment proposal created",
            ""
        );

        emit InvestmentCreated(investmentId, _name, fundNeeded, grade, investments[investmentId].deadline);
        
        return investmentId;
    }

    function getInvestment(uint256 investmentId) 
        external 
        view 
        investmentExists(investmentId)
        returns (Investment memory) 
    {
        return investments[investmentId];
    }

    function getAllInvestments() external view returns (Investment[] memory) {
        Investment[] memory all = new Investment[](investmentCount);
        for (uint256 i = 1; i <= investmentCount; i++) {
            all[i - 1] = investments[i];
        }
        return all;
    }

    function getInvestmentsByStatus(ILocalDAO.Status status) 
        external 
        view 
        returns (Investment[] memory) 
    {
        uint256 count = 0;
        for (uint256 i = 1; i <= investmentCount; i++) {
            if (investments[i].status == status) {
                count++;
            }
        }

        Investment[] memory result = new Investment[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= investmentCount; i++) {
            if (investments[i].status == status) {
                result[index] = investments[i];
                index++;
            }
        }
        return result;
    }

    // ===== VOTING =====
    /**
     * @notice Cast a vote on an investment proposal
     * @dev Upvotes require USDC staking (1 USDC = 1 vote). Voters can add more votes by calling again.
     * @dev Downvotes are free and allowed only once per user per investment.
     * @dev Only verified members can vote. Supports multiple upvotes per user (e.g. stake 10 USDC for 10 votes).
     * @param investmentId ID of the investment to vote on
     * @param numberOfVotes Amount of USDC to stake (must be > 0 for upvote, 0 for downvote)
     * @param voteValue 1 for upvote, 0 for downvote
     */
    function vote(
        uint256 investmentId,
        uint256 numberOfVotes,
        uint8 voteValue
    ) 
        external 
        onlyVerifiedMember 
        investmentExists(investmentId) 
        nonReentrant
        whenNotPaused
    {
        Investment storage inv = investments[investmentId];
        if (inv.status != ILocalDAO.Status.PENDING) revert NotPending();
        if (block.timestamp > inv.deadline) revert DeadlinePassed();
        if (voteValue > 1) revert InvalidVoteValue();

        Vote storage userVote = votes[investmentId][msg.sender];

        if (voteValue == 1) {
            if (numberOfVotes == 0) revert UpvoteRequiresStake();
            if (IERC20(usdcAddress).balanceOf(msg.sender) < numberOfVotes) revert InsufficientBalance();
            if (IERC20(usdcAddress).allowance(msg.sender, address(this)) < numberOfVotes) revert InsufficientAllowance();
            if (userVote.numberOfVotes != 0 && userVote.voteValue != 1) revert CannotChangeDownToUp();

            IERC20(usdcAddress).safeTransferFrom(msg.sender, address(this), numberOfVotes);

            // Accumulate stake instead of replacing
            userVote.voter = msg.sender;
            userVote.investmentId = investmentId;
            userVote.numberOfVotes += numberOfVotes;
            userVote.voteValue = 1;
            userVote.timestamp = block.timestamp;
            // preserve hasClaimedYield and yieldClaimed as-is

            inv.upvotes += numberOfVotes;
            totalValueLocked += numberOfVotes;
        } else {
            if (userVote.numberOfVotes != 0) revert AlreadyVoted();
            if (numberOfVotes != 0) revert DownvoteNoStake();

            userVote.voter = msg.sender;
            userVote.investmentId = investmentId;
            userVote.numberOfVotes = 0;
            userVote.voteValue = 0;
            userVote.timestamp = block.timestamp;
            userVote.hasClaimedYield = false;
            userVote.yieldClaimed = 0;

            inv.downvotes++;
        }

        _addActivity(
            investmentId,
            "vote_cast",
            string(abi.encodePacked("Vote cast by ", StringUtils.addressToString(msg.sender))),
            ""
        );

        emit VoteCast(investmentId, msg.sender, numberOfVotes, voteValue, block.timestamp);
    }

    function getVote(uint256 investmentId, address voter)
        external
        view
        returns (Vote memory)
    {
        return votes[investmentId][voter];
    }

    function getVoteCounts(uint256 investmentId)
        external
        view
        returns (uint256 upvotes, uint256 downvotes)
    {
        Investment memory inv = investments[investmentId];
        return (inv.upvotes, inv.downvotes);
    }

    // ===== INVESTMENT ACTIVATION =====
    /**
     * @notice Activate an investment proposal after voting succeeds
     * @dev Only admins can activate. Requires upvotes >= fundNeeded and deadline not passed
     * @param investmentId ID of the investment to activate
     */
    function activateInvestment(uint256 investmentId) 
        external 
        onlyAdmin 
        investmentExists(investmentId)
        whenNotPaused
    {
        Investment storage inv = investments[investmentId];
        
        require(
            InvestmentManager.canActivate(
                inv.upvotes,
                inv.fundNeeded,
                inv.deadline,
                block.timestamp
            ),
            "LocalDAO: Investment does not meet activation requirements"
        );
        require(inv.status == ILocalDAO.Status.PENDING, "LocalDAO: Investment is not in pending status");

        inv.status = ILocalDAO.Status.ACTIVE;
        activeInvestmentCount++;

        // Lock escrowed funds for this investment to prevent mixing
        uint256 lockAmount = inv.fundNeeded;
        // Ensure contract holds enough of the staked funds (upvotes) — use min(upvotes, fundNeeded)
        if (inv.upvotes < lockAmount) {
            lockAmount = inv.upvotes;
        }
        escrowedAmount[investmentId] = lockAmount;
        escrowTotal[investmentId] = lockAmount;

        emit FundsLocked(investmentId, lockAmount);

        _addActivity(
            investmentId,
            "investment_active",
            "Investment activated by admin",
            ""
        );

        emit InvestmentActivated(investmentId, block.timestamp);
    }

    /**
     * @notice Mark an investment as incomplete if funding goal not met
     * @dev Only admins can mark incomplete. Requires deadline passed and upvotes < fundNeeded
     * @param investmentId ID of the investment to mark incomplete
     */
    function markInvestmentIncomplete(uint256 investmentId) 
        external 
        onlyAdmin 
        investmentExists(investmentId)
        whenNotPaused
    {
        Investment storage inv = investments[investmentId];
        
        require(
            InvestmentManager.shouldMarkIncomplete(
                inv.upvotes,
                inv.fundNeeded,
                inv.deadline,
                block.timestamp
            ),
            "LocalDAO: Investment does not meet incomplete criteria"
        );
        require(inv.status == ILocalDAO.Status.PENDING, "LocalDAO: Investment is not in pending status");

        inv.status = ILocalDAO.Status.INCOMPLETE;

        _addActivity(
            investmentId,
            "investment_incomplete",
            "Investment marked as incomplete",
            ""
        );

        emit InvestmentIncomplete(investmentId, block.timestamp);
    }

    /**
     * @notice Extend the voting deadline for an investment
     * @dev Only finance managers can extend. Only Grade A and B investments can be extended
     * @dev Maximum 3 extensions per investment
     * @param investmentId ID of the investment
     * @param additionalDays Days to add (1-90 days)
     */
    function extendDeadline(
        uint256 investmentId,
        uint256 additionalDays
    ) 
        external 
        onlyFinanceManager 
        investmentExists(investmentId)
        whenNotPaused
    {
        Investment storage inv = investments[investmentId];
        
        require(
            InvestmentManager.canExtendDeadline(
                InvestmentManager.Grade(uint8(inv.grade)),
                inv.extensionCount,
                MAX_EXTENSIONS
            ),
            "LocalDAO: Deadline cannot be extended (check grade and extension limit)"
        );
        require(additionalDays > 0 && additionalDays <= 90, "LocalDAO: Extension must be between 1 and 90 days");

        inv.deadline = InvestmentManager.calculateNewDeadline(inv.deadline, additionalDays);
        inv.extensionCount++;

        _addActivity(
            investmentId,
            "deadline_extended",
            string(abi.encodePacked("Deadline extended by ", StringUtils.uintToString(additionalDays), " days")),
            ""
        );

        emit DeadlineExtended(investmentId, inv.deadline, inv.extensionCount);
    }

    function canActivateInvestment(uint256 investmentId)
        external
        view
        investmentExists(investmentId)
        returns (bool)
    {
        Investment memory inv = investments[investmentId];
        return InvestmentManager.canActivate(
            inv.upvotes,
            inv.fundNeeded,
            inv.deadline,
            block.timestamp
        );
    }

    /**
     * @notice Release the next phase of funds for an active investment
     * @dev Phases: 1 = 30%, 2 = +40% (total 70%), 3 = +30% (total 100%)
     * @param investmentId ID of the investment
     * @param recipient Address to receive the released funds (defaults to investment creator if zero)
     */
    function releaseNextPhase(uint256 investmentId, address recipient)
        external
        onlyAdmin
        investmentExists(investmentId)
        nonReentrant
        whenNotPaused
    {
        Investment storage inv = investments[investmentId];
        require(inv.status == ILocalDAO.Status.ACTIVE || inv.status == ILocalDAO.Status.ENDED, "LocalDAO: Investment not active or ended");

        uint8 completed = releasePhaseCompleted[investmentId];
        require(completed < 3, "LocalDAO: All phases already released");

        uint256 escrow = escrowedAmount[investmentId];
        require(escrow > 0, "LocalDAO: No escrowed funds for investment");

        uint8 nextPhase = completed + 1;
        uint256 percent;
        if (nextPhase == 1) percent = PHASE1_PERCENT;
        else if (nextPhase == 2) percent = PHASE2_PERCENT;
        else percent = PHASE3_PERCENT;

        // Use original escrow total for percent calculations to avoid compounding on remaining balance
        uint256 total = escrowTotal[investmentId];
        uint256 amount = (total * percent) / 100;
        // For last phase, send remaining to avoid rounding issues
        if (nextPhase == 3) {
            uint256 sentSoFar = 0;
            if (releasePhaseCompleted[investmentId] >= 1) sentSoFar += (total * PHASE1_PERCENT) / 100;
            if (releasePhaseCompleted[investmentId] >= 2) sentSoFar += (total * PHASE2_PERCENT) / 100;
            amount = total > sentSoFar ? total - sentSoFar : 0;
        }

        // Ensure releases cannot exceed total votes/stake for the investment
        uint256 releasedSoFar = escrowTotal[investmentId] - escrowedAmount[investmentId];
        require(releasedSoFar + amount <= inv.upvotes, "LocalDAO: Release would exceed votes/stake");

        require(amount > 0, "LocalDAO: Release amount is zero");

        address to = recipient == address(0) ? inv.createdBy : recipient;

        // Transfer funds
        IERC20(usdcAddress).safeTransfer(to, amount);

        // Update escrow accounting
        escrowedAmount[investmentId] -= amount;
        releasePhaseCompleted[investmentId] = nextPhase;

        emit FundsReleased(investmentId, nextPhase, amount, to);
    }

    // ===== REFUNDS =====
    /**
     * @notice Withdraw staked USDC from an incomplete investment
     * @dev Can be called by anyone who staked, even if they're no longer a member
     * @param investmentId ID of the incomplete investment
     */
    function withdrawStake(uint256 investmentId)
        external
        investmentExists(investmentId)
        nonReentrant
        whenNotPaused
    {
        Investment storage inv = investments[investmentId];
        require(inv.status == ILocalDAO.Status.INCOMPLETE, "LocalDAO: Investment is not incomplete");

        Vote storage userVote = votes[investmentId][msg.sender];
        require(userVote.numberOfVotes > 0, "LocalDAO: No stake to withdraw");

        uint256 amount = userVote.numberOfVotes;
        userVote.numberOfVotes = 0;
        totalValueLocked -= amount;

        IERC20(usdcAddress).safeTransfer(msg.sender, amount);

        emit StakeWithdrawn(investmentId, msg.sender, amount);
    }

    function getWithdrawableAmount(uint256 investmentId, address voter)
        external
        view
        investmentExists(investmentId)
        returns (uint256)
    {
        Investment memory inv = investments[investmentId];
        if (inv.status != ILocalDAO.Status.INCOMPLETE) {
            return 0;
        }

        Vote memory userVote = votes[investmentId][voter];
        return userVote.numberOfVotes;
    }

    // ===== MULTI-SIG YIELD FLOW =====
    event YieldDepositProposed(
        uint256 indexed proposalId,
        uint256 indexed investmentId,
        uint256 amount,
        address proposer,
        uint256 timestamp
    );

    event YieldDepositApproved(
        uint256 indexed proposalId,
        address indexed admin,
        uint256 approvals
    );

    event YieldDepositExecuted(
        uint256 indexed proposalId,
        uint256 indexed investmentId,
        uint256 amount,
        string expenseReportCID,
        uint256 timestamp
    );

    /**
     * @notice Propose a yield deposit (creates a multisig proposal)
     * @dev Only finance managers can propose. DAO must have at least REQUIRED_ADMIN_COUNT admins for 3/5 rule
     */
    function proposeYieldDeposit(
        uint256 investmentId,
        uint256 yieldAmount,
        string memory expenseReportCID
    ) public onlyFinanceManager investmentExists(investmentId) whenNotPaused returns (uint256) {
        require(yieldAmount > 0, "LocalDAO: Yield amount must be greater than zero");
        require(admins.length >= REQUIRED_ADMIN_COUNT, "LocalDAO: Not enough admins for 3/5 multisig");

        yieldProposalCount++;
        uint256 pid = yieldProposalCount;

        yieldProposals[pid] = YieldProposal({
            id: pid,
            investmentId: investmentId,
            amount: yieldAmount,
            expenseReportCID: expenseReportCID,
            proposer: msg.sender,
            approvals: 0,
            executed: false,
            createdAt: block.timestamp
        });

        emit YieldDepositProposed(pid, investmentId, yieldAmount, msg.sender, block.timestamp);

        return pid;
    }

    /**
     * @notice Admin approves a yield deposit proposal
     */
    function approveYieldDeposit(uint256 proposalId) external onlyAdmin whenNotPaused {
        YieldProposal storage p = yieldProposals[proposalId];
        require(p.id != 0, "LocalDAO: Invalid proposal");
        require(!p.executed, "LocalDAO: Proposal already executed");
        require(!yieldProposalApprovals[proposalId][msg.sender], "LocalDAO: Admin already approved");

        yieldProposalApprovals[proposalId][msg.sender] = true;
        p.approvals++;

        emit YieldDepositApproved(proposalId, msg.sender, p.approvals);
    }

    /**
     * @notice Execute an approved yield deposit after required approvals
     * @dev Transfers USDC from proposer to contract and updates distributions
     */
    function executeYieldDeposit(uint256 proposalId) external nonReentrant whenNotPaused {
        YieldProposal storage p = yieldProposals[proposalId];
        require(p.id != 0, "LocalDAO: Invalid proposal");
        require(!p.executed, "LocalDAO: Proposal already executed");
        require(p.approvals >= REQUIRED_YIELD_APPROVALS, "LocalDAO: Not enough approvals");

        Investment storage inv = investments[p.investmentId];
        require(
            InvestmentManager.canDepositYield(InvestmentManager.Status(uint8(inv.status))),
            "LocalDAO: Investment is not active"
        );

        // Check proposer has funded and allowed tokens
        require(
            IERC20(usdcAddress).balanceOf(p.proposer) >= p.amount,
            "LocalDAO: Proposer has insufficient USDC balance"
        );
        require(
            IERC20(usdcAddress).allowance(p.proposer, address(this)) >= p.amount,
            "LocalDAO: Insufficient USDC allowance from proposer"
        );

        // Transfer from proposer
        IERC20(usdcAddress).safeTransferFrom(p.proposer, address(this), p.amount);

        inv.totalYieldGenerated += p.amount;

        YieldDistribution storage dist = yieldDistributions[p.investmentId];
        dist.investmentId = p.investmentId;
        dist.totalAmount += p.amount;
        dist.remainingAmount += p.amount;
        dist.expenseReportCID = p.expenseReportCID;
        dist.timestamp = block.timestamp;

        p.executed = true;

        _addActivity(
            p.investmentId,
            "yield_deposited",
            string(abi.encodePacked("Yield deposited: ", StringUtils.uintToString(p.amount))),
            p.expenseReportCID
        );

        emit YieldDepositExecuted(proposalId, p.investmentId, p.amount, p.expenseReportCID, block.timestamp);
        emit YieldDeposited(p.investmentId, p.amount, p.expenseReportCID, block.timestamp);
    }

    // ===== YIELD MANAGEMENT =====
    /**
     * @notice Deposit yield generated from an active investment
     * @dev Only finance managers can deposit yield. Must provide expense report CID
     * @dev Off-chain: Finance manager should verify yield amount matches actual returns before depositing
     * @param investmentId ID of the active investment
     * @param yieldAmount Amount of yield in USDC to deposit
     * @param expenseReportCID IPFS CID of expense report document
     */
    function depositYield(
        uint256 investmentId,
        uint256 yieldAmount,
        string memory expenseReportCID
    ) 
        external 
        onlyFinanceManager 
        investmentExists(investmentId) 
        nonReentrant
        whenNotPaused
    {
        // New multisig flow: create a yield deposit proposal (3-of-5 admin approvals required)
        require(admins.length >= REQUIRED_ADMIN_COUNT, "LocalDAO: Not enough admins for 3/5 multisig");
        // create proposal (reuses proposeYieldDeposit to centralize logic)
        proposeYieldDeposit(investmentId, yieldAmount, expenseReportCID);
    }

    /**
     * @notice Claim yield from an active investment
     * @dev Can be called by anyone who staked (upvoted), even if they're no longer a member
     * @dev Yield is distributed proportionally based on stake amount
     * @param investmentId ID of the active investment
     */
    function claimYield(uint256 investmentId)
        external
        investmentExists(investmentId)
        hasStakeInInvestment(investmentId)
        nonReentrant
        whenNotPaused
    {
        Investment storage inv = investments[investmentId];
        require(inv.status == ILocalDAO.Status.ACTIVE, "LocalDAO: Investment is not active");

        Vote storage userVote = votes[investmentId][msg.sender];
        require(!userVote.hasClaimedYield, "LocalDAO: Yield already claimed");

        uint256 claimable = YieldCalculator.calculateUserYield(
            userVote.numberOfVotes,
            inv.upvotes,
            inv.totalYieldGenerated
        );

        require(claimable > 0, "LocalDAO: No yield available to claim");
        require(
            YieldCalculator.validateDistribution(
                inv.totalYieldDistributed,
                claimable,
                inv.totalYieldGenerated
            ),
            "LocalDAO: Distribution would exceed total yield"
        );

        userVote.hasClaimedYield = true;
        userVote.yieldClaimed = claimable;
        inv.totalYieldDistributed += claimable;

        YieldDistribution storage dist = yieldDistributions[investmentId];
        dist.distributedAmount += claimable;
        dist.remainingAmount -= claimable;

        IERC20(usdcAddress).safeTransfer(msg.sender, claimable);

        emit YieldClaimed(investmentId, msg.sender, claimable, block.timestamp);
    }

    function _calculateClaimableYield(
        uint256 investmentId,
        address voter
    ) internal view returns (uint256 claimableAmount) {
        Investment memory inv = investments[investmentId];
        if (inv.status != ILocalDAO.Status.ACTIVE) {
            return 0;
        }

        Vote memory userVote = votes[investmentId][voter];
        if (userVote.numberOfVotes == 0 || userVote.voteValue != 1 || userVote.hasClaimedYield) {
            return 0;
        }

        return YieldCalculator.calculateUserYield(
            userVote.numberOfVotes,
            inv.upvotes,
            inv.totalYieldGenerated
        );
    }

    function calculateClaimableYield(
        uint256 investmentId,
        address voter
    ) 
        external 
        view 
        investmentExists(investmentId)
        returns (uint256 claimableAmount) 
    {
        return _calculateClaimableYield(investmentId, voter);
    }

    function getYieldDistribution(uint256 investmentId)
        external
        view
        investmentExists(investmentId)
        returns (YieldDistribution memory)
    {
        return yieldDistributions[investmentId];
    }

    /**
     * @notice Get per-investment analytics for ROI and yield performance
     * @dev Uses basis points so callers can render precise percentages without floating point math
     * @param investmentId ID of the investment to inspect
     */
    function getInvestmentAnalytics(uint256 investmentId)
        external
        view
        investmentExists(investmentId)
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
        Investment memory inv = investments[investmentId];
        YieldDistribution memory dist = yieldDistributions[investmentId];

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

    /**
     * @notice Aggregate a user's earnings and ROI across all DAO investments
     * @param user Address to inspect
     */
    function getUserAnalytics(address user)
        external
        view
        returns (
            uint256 totalStaked,
            uint256 totalClaimedYield,
            uint256 totalClaimableYield,
            uint256 realizedRoiBps
        )
    {
        for (uint256 i = 1; i <= investmentCount; i++) {
            Vote memory userVote = votes[i][user];
            if (userVote.numberOfVotes == 0 || userVote.voteValue != 1) {
                continue;
            }

            totalStaked += userVote.numberOfVotes;
            totalClaimedYield += userVote.yieldClaimed;
            totalClaimableYield += _calculateClaimableYield(i, user);
        }

        realizedRoiBps = totalStaked == 0 ? 0 : YieldCalculator.calculateYieldPercentage(totalClaimedYield, totalStaked);
    }

    // ===== INVESTMENT CLOSURE =====
    /**
     * @notice Close an investment after all yield is distributed
     * @dev Only admins can close. Requires all yield to be distributed
     * @param investmentId ID of the investment to close
     */
    function closeInvestment(uint256 investmentId)
        external
        onlyAdmin
        investmentExists(investmentId)
        whenNotPaused
    {
        Investment storage inv = investments[investmentId];
        require(
            InvestmentManager.canCloseInvestment(
                InvestmentManager.Status(uint8(inv.status)),
                inv.totalYieldGenerated,
                inv.totalYieldDistributed
            ),
            "LocalDAO: Investment cannot be closed (check status and yield distribution)"
        );
        require(activeInvestmentCount > 0, "LocalDAO: No active investments to close");

        inv.status = ILocalDAO.Status.ENDED;
        activeInvestmentCount--;

        _addActivity(
            investmentId,
            "investment_closed",
            "Investment closed after yield distribution",
            ""
        );

        emit InvestmentClosed(investmentId, block.timestamp);
    }

    /**
     * @notice Recover unclaimed yield after grace period
     * @dev Only creator/admin can call. Requires investment to be ENDED and grace period passed
     * @dev Off-chain: Admin should notify all stakeholders before recovery
     * @param investmentId ID of the ended investment
     * @param recipient Address to receive unclaimed yield (typically DAO treasury)
     */
    function sweepUnclaimedYield(
        uint256 investmentId,
        address recipient
    )
        external
        onlyAdmin
        investmentExists(investmentId)
        nonReentrant
        whenNotPaused
    {
        Investment storage inv = investments[investmentId];
        require(inv.status == ILocalDAO.Status.ENDED, "LocalDAO: Investment must be ended");
        require(recipient != address(0), "LocalDAO: Invalid recipient address");
        
        YieldDistribution storage dist = yieldDistributions[investmentId];
        require(dist.remainingAmount > 0, "LocalDAO: No unclaimed yield to recover");
        
        // Check if grace period has passed since last yield deposit or investment closure
        uint256 gracePeriodEnd = dist.timestamp + GRACE_PERIOD_FOR_UNCLAIMED_YIELD;
        require(block.timestamp >= gracePeriodEnd, "LocalDAO: Grace period not yet expired");

        uint256 unclaimedAmount = dist.remainingAmount;
        dist.remainingAmount = 0;
        dist.distributedAmount += unclaimedAmount; // Mark as distributed for accounting

        IERC20(usdcAddress).safeTransfer(recipient, unclaimedAmount);

        _addActivity(
            investmentId,
            "yield_recovered",
            string(abi.encodePacked("Unclaimed yield recovered: ", StringUtils.uintToString(unclaimedAmount))),
            ""
        );

        emit UnclaimedYieldRecovered(investmentId, recipient, unclaimedAmount, block.timestamp);
    }

    // ===== ACTIVITY TIMELINE =====
    function _addActivity(
        uint256 investmentId,
        string memory eventType,
        string memory details,
        string memory documentCID
    ) internal {
        investmentTimeline[investmentId].push(Activity({
            eventType: eventType,
            timestamp: block.timestamp,
            details: details,
            documentCID: documentCID,
            actor: msg.sender
        }));

        emit ActivityLogged(investmentId, eventType, details, block.timestamp);
    }

    function getInvestmentTimeline(uint256 investmentId)
        external
        view
        investmentExists(investmentId)
        returns (Activity[] memory)
    {
        return investmentTimeline[investmentId];
    }

    // ===== ADMIN FUNCTIONS =====
    /**
     * @notice Add a new admin to the DAO
     * @dev Only creator can add admins. Admins have significant powers - use with caution
     * @dev Off-chain: Creator should verify admin identity and trustworthiness before adding
     * @param admin Address of the new admin
     */
    function addAdmin(address admin) external onlyCreator {
        require(admin != address(0), "LocalDAO: Invalid admin address");
        require(!isAdmin[admin], "LocalDAO: Address is already an admin");

        isAdmin[admin] = true;
        admins.push(admin);

        emit AdminAdded(admin);
    }

    /**
     * @notice Remove an admin from the DAO
     * @dev Only creator can remove admins
     * @param admin Address of the admin to remove
     */
    function removeAdmin(address admin) external onlyCreator {
        require(isAdmin[admin], "LocalDAO: Address is not an admin");

        isAdmin[admin] = false;
        
        // Remove from array
        for (uint256 i = 0; i < admins.length; i++) {
            if (admins[i] == admin) {
                admins[i] = admins[admins.length - 1];
                admins.pop();
                break;
            }
        }

        emit AdminRemoved(admin);
    }

    /**
     * @notice Add a new finance manager to the DAO
     * @dev Only creator can add finance managers. Finance managers can deposit yield and extend deadlines
     * @dev Off-chain: Creator should verify finance manager credentials and trustworthiness
     * @param manager Address of the new finance manager
     */
    function addFinanceManager(address manager) external onlyCreator {
        require(manager != address(0), "LocalDAO: Invalid finance manager address");
        require(!isFinanceManager[manager], "LocalDAO: Address is already a finance manager");

        isFinanceManager[manager] = true;

        emit FinanceManagerAdded(manager);
    }

    /**
     * @notice Remove a finance manager from the DAO
     * @dev Only creator can remove finance managers
     * @param manager Address of the finance manager to remove
     */
    function removeFinanceManager(address manager) external onlyCreator {
        require(isFinanceManager[manager], "LocalDAO: Address is not a finance manager");

        isFinanceManager[manager] = false;

        emit FinanceManagerRemoved(manager);
    }

    /**
     * @notice Update DAO description and logo URI
     * @dev Only admins can update DAO information
     * @param newDescription New description for the DAO
     * @param newLogoURI New logo URI (IPFS CID or URL)
     */
    function updateDAOInfo(
        string memory newDescription,
        string memory newLogoURI
    ) external onlyAdmin whenNotPaused {
        require(bytes(newDescription).length > 0, "LocalDAO: Description cannot be empty");
        description = newDescription;
        logoURI = newLogoURI;
    }

    /**
     * @notice Pause all DAO operations (emergency function)
     * @dev Only creator can pause. Prevents all state-changing operations
     */
    function pause() external onlyCreator {
        _pause();
        emit DAOPaused(block.timestamp);
    }

    /**
     * @notice Unpause DAO operations
     * @dev Only creator can unpause
     */
    function unpause() external onlyCreator {
        _unpause();
        emit DAOUnpaused(block.timestamp);
    }

    // ===== EVENTS =====
    event MemberAdded(address indexed member, uint256 timestamp);
    event MemberKYCVerified(address indexed member, uint256 timestamp);
    event MemberRemoved(address indexed member, uint256 timestamp);
    event MemberExited(address indexed member, uint256 timestamp);

    event InvestmentCreated(
        uint256 indexed investmentId,
        string name,
        uint256 fundNeeded,
        Grade grade,
        uint256 deadline
    );
    event InvestmentActivated(uint256 indexed investmentId, uint256 timestamp);
    event InvestmentClosed(uint256 indexed investmentId, uint256 timestamp);
    event InvestmentIncomplete(uint256 indexed investmentId, uint256 timestamp);
    event DeadlineExtended(
        uint256 indexed investmentId,
        uint256 newDeadline,
        uint256 extensionCount
    );

    event FundsLocked(uint256 indexed investmentId, uint256 amount);
    event FundsReleased(uint256 indexed investmentId, uint8 phase, uint256 amount, address indexed recipient);

    event VoteCast(
        uint256 indexed investmentId,
        address indexed voter,
        uint256 numberOfVotes,
        uint8 voteValue,
        uint256 timestamp
    );
    event StakeWithdrawn(
        uint256 indexed investmentId,
        address indexed voter,
        uint256 amount
    );

    event YieldDeposited(
        uint256 indexed investmentId,
        uint256 amount,
        string expenseReportCID,
        uint256 timestamp
    );
    event YieldClaimed(
        uint256 indexed investmentId,
        address indexed voter,
        uint256 amount,
        uint256 timestamp
    );

    event ActivityLogged(
        uint256 indexed investmentId,
        string eventType,
        string details,
        uint256 timestamp
    );

    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);
    event FinanceManagerAdded(address indexed manager);
    event FinanceManagerRemoved(address indexed manager);
    event DAOPaused(uint256 timestamp);
    event DAOUnpaused(uint256 timestamp);
    event UnclaimedYieldRecovered(
        uint256 indexed investmentId,
        address indexed recipient,
        uint256 amount,
        uint256 timestamp
    );
}
