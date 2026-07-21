export interface WordSegment {
  text: string;
  changed: boolean;
}

/**
 * Lightweight intra-line diff based on common prefix/suffix. Good enough to
 * emphasize the part of a line that actually changed between a removed line and
 * its paired added line (IntelliJ-style word highlight), without a full O(n^2)
 * token diff on every line.
 */
export function computeWordDiff(
  oldStr: string,
  newStr: string,
): { old: WordSegment[]; new: WordSegment[] } {
  if (oldStr === newStr) {
    return { old: [{ text: oldStr, changed: false }], new: [{ text: newStr, changed: false }] };
  }

  const oldArr = Array.from(oldStr);
  const newArr = Array.from(newStr);

  let prefix = 0;
  const maxPrefix = Math.min(oldArr.length, newArr.length);
  while (prefix < maxPrefix && oldArr[prefix] === newArr[prefix]) prefix++;

  let suffix = 0;
  const maxSuffix = Math.min(oldArr.length - prefix, newArr.length - prefix);
  while (
    suffix < maxSuffix &&
    oldArr[oldArr.length - 1 - suffix] === newArr[newArr.length - 1 - suffix]
  ) {
    suffix++;
  }

  const build = (arr: string[]): WordSegment[] => {
    const head = arr.slice(0, prefix).join("");
    const mid = arr.slice(prefix, arr.length - suffix).join("");
    const tail = arr.slice(arr.length - suffix).join("");
    const segs: WordSegment[] = [];
    if (head) segs.push({ text: head, changed: false });
    if (mid) segs.push({ text: mid, changed: true });
    if (tail) segs.push({ text: tail, changed: false });
    if (segs.length === 0) segs.push({ text: "", changed: false });
    return segs;
  };

  return { old: build(oldArr), new: build(newArr) };
}
