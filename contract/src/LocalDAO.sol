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

contract LocalDAO is ILocalDAO, Pausable, ReentrancyGuard, Initializable {
    using SafeERC20 for IERC20;

    // ===== CUSTOM ERRORS =====
    error NotCreator();
    error Unauthorized();
    error NotActiveMember();
    error KYCNotVerified();
    error NoStake();
    error OnlyUpvoters();
    error ZeroAddress();
    error AlreadyMember();
    error MembershipFull();
    error NotMember();
    error KYCAlreadyVerified();
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
    error InvalidParams();
    error EmptyName();
    error CannotExtend();
    error InvalidExtensionDays();
    error AllPhasesReleased();
    error NoEscrowedFunds();
    error ExceedsStake();
    error ZeroAmount();
    error NotIncomplete();
    error NoStakeToWithdraw();
    error NotEnoughAdmins();
    error InvalidProposal();
    error AlreadyExecuted();
    error AlreadyApproved();
    error NotEnoughApprovals();
    error InsufficientProposerBalance();
    error InsufficientProposerAllowance();
    error InvestmentNotActive();
    error YieldAlreadyClaimed();
    error NoYieldAvailable();
    error YieldExceedsTotal();
    error CannotClose();
    error NoActiveInvestments();
    error NotEnded();
    error NoUnclaimedYield();
    error GracePeriodActive();
    error AlreadyAdmin();
    error NotAnAdmin();
    error AlreadyFinanceManager();
    error NotAFinanceManager();
    error EmptyDescription();
    /// @notice Only the yield proposer or an admin/creator may execute after approvals (prevents third-party griefing).
    error UnauthorizedYieldExec();

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
    // Structs are defined in ILocalDAO; inherited via `is ILocalDAO`
    mapping(address => User) public members;
    address[] public memberAddresses;
    uint256 public memberCount;

    // ===== INVESTMENTS =====
    mapping(uint256 => Investment) public investments;
    uint256 public investmentCount;
    uint256 public activeInvestmentCount;

    // ===== VOTING =====
    mapping(uint256 => mapping(address => Vote)) public votes;

    // ===== YIELD TRACKING =====
    mapping(uint256 => YieldDistribution) public yieldDistributions;

    // ===== YIELD PROPOSALS (MULTI-SIG) =====
    uint256 public constant REQUIRED_YIELD_APPROVALS = 3;
    uint256 public constant REQUIRED_ADMIN_COUNT = 5;

    uint256 public yieldProposalCount;
    mapping(uint256 => YieldProposal) public yieldProposals;
    mapping(uint256 => mapping(address => bool)) public yieldProposalApprovals;

    // ===== ACTIVITY TIMELINE =====
    mapping(uint256 => Activity[]) public investmentTimeline;

    // ===== TREASURY =====
    address public usdcAddress;
    uint256 public totalValueLocked;

    // ===== ESCROW =====
    mapping(uint256 => uint256) public escrowedAmount;
    mapping(uint256 => uint256) public escrowTotal;
    mapping(uint256 => uint8) public releasePhaseCompleted;

    uint256 public constant PHASE1_PERCENT = 30;
    uint256 public constant PHASE2_PERCENT = 40;
    uint256 public constant PHASE3_PERCENT = 30;
    uint256 public constant MAX_EXTENSIONS = 3;
    uint256 public constant GRACE_PERIOD_FOR_UNCLAIMED_YIELD = 90 days;

    // ===== MODIFIERS =====
    modifier onlyCreator() {
        if (msg.sender != creator) revert NotCreator();
        _;
    }

    modifier onlyAdmin() {
        if (!isAdmin[msg.sender] && msg.sender != creator) revert Unauthorized();
        _;
    }

    modifier onlyFinanceManager() {
        if (!isFinanceManager[msg.sender] && !isAdmin[msg.sender] && msg.sender != creator) revert Unauthorized();
        _;
    }

    modifier onlyVerifiedMember() {
        if (!members[msg.sender].isActive) revert NotActiveMember();
        if (!members[msg.sender].kycVerified) revert KYCNotVerified();
        _;
    }

    modifier hasStakeInInvestment(uint256 investmentId) {
        Vote storage userVote = votes[investmentId][msg.sender];
        if (userVote.numberOfVotes == 0) revert NoStake();
        if (userVote.voteValue != 1) revert OnlyUpvoters();
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
        if (_creator == address(0)) revert ZeroAddress();
        if (_usdcAddress == address(0)) revert ZeroAddress();

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
    function addMember(address wallet, bytes32 kycProofHash) external onlyAdmin whenNotPaused {
        if (wallet == address(0)) revert ZeroAddress();
        if (members[wallet].isActive) revert AlreadyMember();
        if (memberCount >= maxMembership) revert MembershipFull();

        // Roster onboarding: admins finalize compliance with verifyMemberKYC before voting.
        members[wallet] = User({
            wallet: wallet,
            kycVerified: false,
            kycProofHash: kycProofHash,
            joinedAt: block.timestamp,
            isActive: true
        });
        memberAddresses.push(wallet);
        memberCount++;

        emit MemberAdded(wallet, block.timestamp);
    }

    function verifyMemberKYC(address wallet) external onlyAdmin whenNotPaused {
        if (!members[wallet].isActive) revert NotMember();
        if (members[wallet].kycVerified) revert KYCAlreadyVerified();

        members[wallet].kycVerified = true;
        emit MemberKYCVerified(wallet, block.timestamp);
    }

    function removeMember(address wallet) external onlyAdmin whenNotPaused {
        if (!members[wallet].isActive) revert NotMember();

        members[wallet].isActive = false;
        memberCount--;

        emit MemberRemoved(wallet, block.timestamp);
    }

    function exitDAO() external whenNotPaused {
        if (!members[msg.sender].isActive) revert NotMember();

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
    function createInvestment(
        string memory _name,
        ILocalDAO.Category category,
        uint256 fundNeeded,
        uint256 expectedYield,
        ILocalDAO.Grade grade,
        uint256 deadline,
        string[] memory documentCIDs
    ) external onlyAdmin whenNotPaused returns (uint256 investmentId) {
        if (!InvestmentManager.validateInvestmentParams(fundNeeded, expectedYield, deadline)) revert InvalidParams();
        if (bytes(_name).length == 0) revert EmptyName();

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

        _addActivity(investmentId, "investment_created", "Investment proposal created", "");

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

    // ===== VOTING =====
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

            // CEI: update state before external transfer (ERC-20 UX best practice).
            userVote.voter = msg.sender;
            userVote.investmentId = investmentId;
            userVote.numberOfVotes += numberOfVotes;
            userVote.voteValue = 1;
            userVote.timestamp = block.timestamp;

            inv.upvotes += numberOfVotes;
            totalValueLocked += numberOfVotes;

            IERC20(usdcAddress).safeTransferFrom(msg.sender, address(this), numberOfVotes);
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

    function getVote(uint256 investmentId, address voter) external view returns (Vote memory) {
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
    function activateInvestment(uint256 investmentId)
        external
        onlyAdmin
        investmentExists(investmentId)
        whenNotPaused
    {
        Investment storage inv = investments[investmentId];

        if (!InvestmentManager.canActivate(inv.upvotes, inv.fundNeeded, inv.deadline, block.timestamp)) revert InvalidParams();
        if (inv.status != ILocalDAO.Status.PENDING) revert NotPending();

        inv.status = ILocalDAO.Status.ACTIVE;
        activeInvestmentCount++;

        uint256 lockAmount = inv.upvotes < inv.fundNeeded ? inv.upvotes : inv.fundNeeded;
        escrowedAmount[investmentId] = lockAmount;
        escrowTotal[investmentId] = lockAmount;

        emit FundsLocked(investmentId, lockAmount);
        _addActivity(investmentId, "investment_active", "Investment activated by admin", "");
        emit InvestmentActivated(investmentId, block.timestamp);
    }

    function markInvestmentIncomplete(uint256 investmentId)
        external
        onlyAdmin
        investmentExists(investmentId)
        whenNotPaused
    {
        Investment storage inv = investments[investmentId];

        if (!InvestmentManager.shouldMarkIncomplete(inv.upvotes, inv.fundNeeded, inv.deadline, block.timestamp)) revert InvalidParams();
        if (inv.status != ILocalDAO.Status.PENDING) revert NotPending();

        inv.status = ILocalDAO.Status.INCOMPLETE;

        _addActivity(investmentId, "investment_incomplete", "Investment marked as incomplete", "");
        emit InvestmentIncomplete(investmentId, block.timestamp);
    }

    function extendDeadline(uint256 investmentId, uint256 additionalDays)
        external
        onlyFinanceManager
        investmentExists(investmentId)
        whenNotPaused
    {
        Investment storage inv = investments[investmentId];

        if (!InvestmentManager.canExtendDeadline(
            InvestmentManager.Grade(uint8(inv.grade)),
            inv.extensionCount,
            MAX_EXTENSIONS
        )) revert CannotExtend();
        if (additionalDays == 0 || additionalDays > 90) revert InvalidExtensionDays();

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
        return InvestmentManager.canActivate(inv.upvotes, inv.fundNeeded, inv.deadline, block.timestamp);
    }

    function releaseNextPhase(uint256 investmentId, address recipient)
        external
        onlyAdmin
        investmentExists(investmentId)
        nonReentrant
        whenNotPaused
    {
        Investment storage inv = investments[investmentId];
        if (inv.status != ILocalDAO.Status.ACTIVE && inv.status != ILocalDAO.Status.ENDED) revert InvalidParams();

        uint8 completed = releasePhaseCompleted[investmentId];
        if (completed >= 3) revert AllPhasesReleased();

        uint256 escrow = escrowedAmount[investmentId];
        if (escrow == 0) revert NoEscrowedFunds();

        uint8 nextPhase = completed + 1;
        uint256 total = escrowTotal[investmentId];
        uint256 amount;

        if (nextPhase == 1) {
            amount = (total * PHASE1_PERCENT) / 100;
        } else if (nextPhase == 2) {
            amount = (total * PHASE2_PERCENT) / 100;
        } else {
            uint256 sentSoFar;
            if (completed >= 1) sentSoFar += (total * PHASE1_PERCENT) / 100;
            if (completed >= 2) sentSoFar += (total * PHASE2_PERCENT) / 100;
            amount = total > sentSoFar ? total - sentSoFar : 0;
        }

        uint256 releasedSoFar = total - escrow;
        if (releasedSoFar + amount > inv.upvotes) revert ExceedsStake();
        if (amount == 0) revert ZeroAmount();

        address to = recipient == address(0) ? inv.createdBy : recipient;

        IERC20(usdcAddress).safeTransfer(to, amount);
        escrowedAmount[investmentId] -= amount;
        releasePhaseCompleted[investmentId] = nextPhase;

        emit FundsReleased(investmentId, nextPhase, amount, to);
    }

    // ===== REFUNDS =====
    function withdrawStake(uint256 investmentId)
        external
        investmentExists(investmentId)
        nonReentrant
        whenNotPaused
    {
        Investment storage inv = investments[investmentId];
        if (inv.status != ILocalDAO.Status.INCOMPLETE) revert NotIncomplete();

        Vote storage userVote = votes[investmentId][msg.sender];
        if (userVote.numberOfVotes == 0) revert NoStakeToWithdraw();

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
        if (investments[investmentId].status != ILocalDAO.Status.INCOMPLETE) return 0;
        return votes[investmentId][voter].numberOfVotes;
    }

    // ===== MULTI-SIG YIELD FLOW =====
    function proposeYieldDeposit(
        uint256 investmentId,
        uint256 yieldAmount,
        string memory expenseReportCID
    ) public onlyFinanceManager investmentExists(investmentId) whenNotPaused returns (uint256) {
        if (yieldAmount == 0) revert ZeroAmount();
        if (admins.length < REQUIRED_ADMIN_COUNT) revert NotEnoughAdmins();

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

    function approveYieldDeposit(uint256 proposalId) external onlyAdmin whenNotPaused {
        YieldProposal storage p = yieldProposals[proposalId];
        if (p.id == 0) revert InvalidProposal();
        if (p.executed) revert AlreadyExecuted();
        if (yieldProposalApprovals[proposalId][msg.sender]) revert AlreadyApproved();

        yieldProposalApprovals[proposalId][msg.sender] = true;
        p.approvals++;

        emit YieldDepositApproved(proposalId, msg.sender, p.approvals);
    }

    function executeYieldDeposit(uint256 proposalId) external nonReentrant whenNotPaused {
        YieldProposal storage p = yieldProposals[proposalId];
        if (p.id == 0) revert InvalidProposal();
        if (p.executed) revert AlreadyExecuted();
        if (p.approvals < REQUIRED_YIELD_APPROVALS) revert NotEnoughApprovals();
        if (msg.sender != p.proposer && !isAdmin[msg.sender] && msg.sender != creator) {
            revert UnauthorizedYieldExec();
        }

        Investment storage inv = investments[p.investmentId];
        if (!InvestmentManager.canDepositYield(InvestmentManager.Status(uint8(inv.status)))) revert InvestmentNotActive();

        if (IERC20(usdcAddress).balanceOf(p.proposer) < p.amount) revert InsufficientProposerBalance();
        if (IERC20(usdcAddress).allowance(p.proposer, address(this)) < p.amount) revert InsufficientProposerAllowance();

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

    // Thin wrapper kept for API compatibility
    function depositYield(
        uint256 investmentId,
        uint256 yieldAmount,
        string memory expenseReportCID
    ) external onlyFinanceManager investmentExists(investmentId) nonReentrant whenNotPaused {
        if (admins.length < REQUIRED_ADMIN_COUNT) revert NotEnoughAdmins();
        proposeYieldDeposit(investmentId, yieldAmount, expenseReportCID);
    }

    // ===== YIELD CLAIMING =====
    function claimYield(uint256 investmentId)
        external
        investmentExists(investmentId)
        hasStakeInInvestment(investmentId)
        nonReentrant
        whenNotPaused
    {
        Investment storage inv = investments[investmentId];
        if (inv.status != ILocalDAO.Status.ACTIVE) revert InvestmentNotActive();

        Vote storage userVote = votes[investmentId][msg.sender];
        if (userVote.hasClaimedYield) revert YieldAlreadyClaimed();

        uint256 claimable = YieldCalculator.calculateUserYield(
            userVote.numberOfVotes,
            inv.upvotes,
            inv.totalYieldGenerated
        );

        if (claimable == 0) revert NoYieldAvailable();
        if (!YieldCalculator.validateDistribution(inv.totalYieldDistributed, claimable, inv.totalYieldGenerated)) revert YieldExceedsTotal();

        userVote.hasClaimedYield = true;
        userVote.yieldClaimed = claimable;
        inv.totalYieldDistributed += claimable;

        YieldDistribution storage dist = yieldDistributions[investmentId];
        dist.distributedAmount += claimable;
        dist.remainingAmount -= claimable;

        IERC20(usdcAddress).safeTransfer(msg.sender, claimable);

        emit YieldClaimed(investmentId, msg.sender, claimable, block.timestamp);
    }

    function getYieldDistribution(uint256 investmentId)
        external
        view
        investmentExists(investmentId)
        returns (YieldDistribution memory)
    {
        return yieldDistributions[investmentId];
    }

    // ===== INVESTMENT CLOSURE =====
    function closeInvestment(uint256 investmentId)
        external
        onlyAdmin
        investmentExists(investmentId)
        whenNotPaused
    {
        Investment storage inv = investments[investmentId];
        if (!InvestmentManager.canCloseInvestment(
            InvestmentManager.Status(uint8(inv.status)),
            inv.totalYieldGenerated,
            inv.totalYieldDistributed
        )) revert CannotClose();
        if (activeInvestmentCount == 0) revert NoActiveInvestments();

        inv.status = ILocalDAO.Status.ENDED;
        activeInvestmentCount--;

        _addActivity(investmentId, "investment_closed", "Investment closed after yield distribution", "");
        emit InvestmentClosed(investmentId, block.timestamp);
    }

    function sweepUnclaimedYield(uint256 investmentId, address recipient)
        external
        onlyAdmin
        investmentExists(investmentId)
        nonReentrant
        whenNotPaused
    {
        Investment storage inv = investments[investmentId];
        if (inv.status != ILocalDAO.Status.ENDED) revert NotEnded();
        if (recipient == address(0)) revert ZeroAddress();

        YieldDistribution storage dist = yieldDistributions[investmentId];
        if (dist.remainingAmount == 0) revert NoUnclaimedYield();
        if (block.timestamp < dist.timestamp + GRACE_PERIOD_FOR_UNCLAIMED_YIELD) revert GracePeriodActive();

        uint256 unclaimedAmount = dist.remainingAmount;
        dist.remainingAmount = 0;
        dist.distributedAmount += unclaimedAmount;

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
    function addAdmin(address admin) external onlyCreator {
        if (admin == address(0)) revert ZeroAddress();
        if (isAdmin[admin]) revert AlreadyAdmin();

        isAdmin[admin] = true;
        admins.push(admin);

        emit AdminAdded(admin);
    }

    function removeAdmin(address admin) external onlyCreator {
        if (!isAdmin[admin]) revert NotAnAdmin();

        isAdmin[admin] = false;

        for (uint256 i = 0; i < admins.length; i++) {
            if (admins[i] == admin) {
                admins[i] = admins[admins.length - 1];
                admins.pop();
                break;
            }
        }

        emit AdminRemoved(admin);
    }

    function addFinanceManager(address manager) external onlyCreator {
        if (manager == address(0)) revert ZeroAddress();
        if (isFinanceManager[manager]) revert AlreadyFinanceManager();

        isFinanceManager[manager] = true;
        emit FinanceManagerAdded(manager);
    }

    function removeFinanceManager(address manager) external onlyCreator {
        if (!isFinanceManager[manager]) revert NotAFinanceManager();

        isFinanceManager[manager] = false;
        emit FinanceManagerRemoved(manager);
    }

    function updateDAOInfo(string memory newDescription, string memory newLogoURI) external onlyAdmin whenNotPaused {
        if (bytes(newDescription).length == 0) revert EmptyDescription();
        description = newDescription;
        logoURI = newLogoURI;
    }

    function pause() external onlyCreator {
        _pause();
        emit DAOPaused(block.timestamp);
    }

    function unpause() external onlyCreator {
        _unpause();
        emit DAOUnpaused(block.timestamp);
    }
}
