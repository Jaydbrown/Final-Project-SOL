import { toast } from 'react-toastify';

export function formatTxError(err: unknown, fallback = 'Something went wrong.'): string {
  const message = err instanceof Error ? err.message : String(err ?? '');
  const lower = message.toLowerCase();

  if (
    lower.includes('user rejected') ||
    lower.includes('user denied') ||
    lower.includes('denied transaction signature')
  ) {
    return 'Action canceled in wallet.';
  }

  const reasonMatch = message.match(/reverted with the following reason:\s*([^]+?)contract call:/i);
  if (reasonMatch?.[1]) {
    return reasonMatch[1].trim();
  }

  // Friendly mapping for custom-error selectors when ABI decode is unavailable.
  if (lower.includes('0xf4d678b8')) return 'Insufficient USDC balance for this vote amount.';
  if (lower.includes('0x13be252b')) return 'Insufficient USDC allowance. Approve USDC and try again.';
  if (lower.includes('0xdd69f6fe')) return 'Enter a vote amount greater than 0 USDC.';
  if (lower.includes('0x7dc6505a')) return 'This proposal is no longer pending.';
  if (lower.includes('0x70f65caa')) return 'Voting deadline has passed.';
  if (lower.includes('0x7c9a1cf9')) return 'You already voted on this proposal.';
  if (lower.includes('0x6bda8a20')) return 'Downvote does not take an amount. Use 0 amount for downvote.';
  if (lower.includes('0x26d748d6')) return 'Invalid proposal selected.';

  const customErrorMatch = message.match(/errorName:\s*([A-Za-z0-9_]+)\b/i);
  if (customErrorMatch?.[1]) {
    const errorName = customErrorMatch[1];
    if (errorName === 'InsufficientBalance') return 'Insufficient USDC balance for this vote amount.';
    if (errorName === 'InsufficientAllowance') return 'Insufficient USDC allowance. Approve USDC and try again.';
    if (errorName === 'UpvoteRequiresStake') return 'Enter a vote amount greater than 0 USDC.';
    if (errorName === 'NotPending') return 'This proposal is no longer pending.';
    if (errorName === 'DeadlinePassed') return 'Voting deadline has passed.';
    if (errorName === 'AlreadyVoted') return 'You already voted on this proposal.';
    if (errorName === 'DownvoteNoStake') return 'Downvote does not take an amount. Use 0 amount for downvote.';
    if (errorName === 'InvalidInvestment') return 'Invalid proposal selected.';
    return errorName;
  }

  const detailsMatch = message.match(/details:\s*([^]+?)version:/i);
  if (detailsMatch?.[1]) {
    return detailsMatch[1].trim();
  }

  return message || fallback;
}

export function notifySuccess(message: string) {
  toast.success(message, { autoClose: 2800 });
}

export function notifyError(message: string) {
  toast.error(message, { autoClose: 4500 });
}

export function notifyWarning(message: string) {
  toast.warning(message, { autoClose: 3500 });
}
