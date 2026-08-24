/** Returns true when a wagmi multicall contains an individual failed contract read. */
export function hasReadFailure(data: readonly { status: string }[] | undefined): boolean {
  return data?.some((result) => result.status === "failure") ?? false;
}

/** Error used when a multicall returned partial failures without rejecting the query itself. */
export function partialReadError(): Error {
  return new Error("One or more contract reads failed. Refresh the page or check the selected network.");
}
