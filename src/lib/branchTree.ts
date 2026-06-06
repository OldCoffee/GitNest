import type { BranchInfo } from "./types";

export type BranchTreeNode =
  | {
      kind: "section";
      id: string;
      label: string;
      children: BranchTreeNode[];
    }
  | {
      kind: "folder";
      id: string;
      label: string;
      fullPrefix: string;
      children: BranchTreeNode[];
    }
  | {
      kind: "branch";
      id: string;
      branch: BranchInfo;
      displayName: string;
    };

function sortBranches(a: BranchInfo, b: BranchInfo) {
  if (a.is_current !== b.is_current) return a.is_current ? -1 : 1;
  return a.name.localeCompare(b.name);
}

function groupBranches(branches: BranchInfo[], prefixStrip = ""): BranchTreeNode[] {
  const topLevel: BranchInfo[] = [];
  const folders = new Map<string, BranchInfo[]>();

  for (const branch of branches) {
    let name = branch.name;
    if (prefixStrip && name.startsWith(`${prefixStrip}/`)) {
      name = name.slice(prefixStrip.length + 1);
    }
    const slash = name.indexOf("/");
    if (slash === -1) {
      topLevel.push({ ...branch, name: prefixStrip ? `${prefixStrip}/${name}` : name });
      continue;
    }
    const folder = name.slice(0, slash);
    const fullName = prefixStrip ? `${prefixStrip}/${name}` : name;
    const entry = folders.get(folder) ?? [];
    entry.push({ ...branch, name: fullName });
    folders.set(folder, entry);
  }

  topLevel.sort(sortBranches);

  const nodes: BranchTreeNode[] = topLevel.map((branch) => ({
    kind: "branch",
    id: branch.name,
    branch,
    displayName: prefixStrip
      ? branch.name.slice(prefixStrip.length + 1)
      : branch.name,
  }));

  for (const [label, items] of [...folders.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const fullPrefix = prefixStrip ? `${prefixStrip}/${label}` : label;
    items.sort((a, b) => {
      const shortA = a.name.slice(fullPrefix.length + 1);
      const shortB = b.name.slice(fullPrefix.length + 1);
      return shortA.localeCompare(shortB);
    });
    nodes.push({
      kind: "folder",
      id: `folder:${fullPrefix}`,
      label,
      fullPrefix,
      children: items.map((branch) => ({
        kind: "branch",
        id: branch.name,
        branch,
        displayName: branch.name.slice(fullPrefix.length + 1),
      })),
    });
  }

  return nodes;
}

export function buildBranchTree(local: BranchInfo[], remote: BranchInfo[]): BranchTreeNode[] {
  const remotePrefix = remote[0]?.name.split("/")[0] ?? "origin";
  return [
    {
      kind: "section",
      id: "section:local",
      label: "Local",
      children: groupBranches(local),
    },
    {
      kind: "section",
      id: "section:remote",
      label: "Remote",
      children: groupBranches(remote, remotePrefix),
    },
  ];
}

export function buildLocalBranchTree(local: BranchInfo[]): BranchTreeNode[] {
  return groupBranches(local);
}

export function buildPopupBranchTree(
  local: BranchInfo[],
  remote: BranchInfo[],
  recentNames: string[],
): BranchTreeNode[] {
  const byName = new Map<string, BranchInfo>();
  for (const b of [...local, ...remote]) {
    byName.set(b.name, b);
  }

  const recentBranches = recentNames
    .map((name) => byName.get(name))
    .filter((b): b is BranchInfo => !!b);

  const remotePrefix = remote[0]?.name.split("/")[0] ?? "origin";
  const sections: BranchTreeNode[] = [];

  if (recentBranches.length > 0) {
    sections.push({
      kind: "section",
      id: "section:recent",
      label: "Recent",
      children: groupBranches(recentBranches),
    });
  }

  sections.push(
    {
      kind: "section",
      id: "section:local",
      label: "Local",
      children: groupBranches(local),
    },
    {
      kind: "section",
      id: "section:remote",
      label: "Remote",
      children: groupBranches(remote, remotePrefix),
    },
  );

  return sections;
}

export function filterBranchTree(nodes: BranchTreeNode[], query: string): BranchTreeNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;

  function walk(node: BranchTreeNode): BranchTreeNode | null {
    if (node.kind === "branch") {
      const hay = `${node.branch.name} ${node.displayName} ${node.branch.upstream ?? ""}`.toLowerCase();
      return hay.includes(q) ? node : null;
    }
    const children = node.children
      .map(walk)
      .filter((n): n is BranchTreeNode => n !== null);
    if (children.length === 0) return null;
    return { ...node, children };
  }

  return nodes.map(walk).filter((n): n is BranchTreeNode => n !== null);
}
