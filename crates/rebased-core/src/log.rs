use std::collections::HashMap;
use std::path::Path;

use crate::{CommitEntry, CommitRef, GitCli, GraphEdge, GraphRow, Result};

/// Optional server-side filters for the commit log.
#[derive(Debug, Default, Clone)]
pub struct LogFilters {
    pub author: Option<String>,
    /// git `--since` value, e.g. "1 week ago".
    pub since: Option<String>,
    /// Limit to commits touching this path.
    pub path: Option<String>,
}

impl LogFilters {
    fn apply(&self, args: &mut Vec<String>) {
        if let Some(author) = self.author.as_ref().filter(|s| !s.is_empty()) {
            args.push(format!("--author={author}"));
        }
        if let Some(since) = self.since.as_ref().filter(|s| !s.is_empty()) {
            args.push(format!("--since={since}"));
        }
    }

    fn apply_path(&self, args: &mut Vec<String>) {
        if let Some(path) = self.path.as_ref().filter(|s| !s.is_empty()) {
            args.push("--".into());
            args.push(path.clone());
        }
    }
}

pub fn log_page(
    repo: &Path,
    git: &GitCli,
    branch: Option<&str>,
    skip: u32,
    limit: u32,
    filters: &LogFilters,
) -> Result<Vec<CommitEntry>> {
    let limit_str = limit.to_string();
    let skip_str = skip.to_string();
    let mut args: Vec<String> = vec![
        "log".into(),
        // Keep commits in commit-date order, but guarantee a parent is never
        // listed before all of its children. Without this, clock-skewed or
        // rebased commits can appear out of topological order, which leaves the
        // commit graph with dangling/disconnected lanes (IntelliJ uses the same
        // ordering to keep the graph connected).
        "--date-order".into(),
        "--date=unix".into(),
        "--decorate=full".into(),
        "--pretty=format:%H%x00%P%x00%an%x00%ae%x00%at%x00%s%x00%D%x00%b%x00END".into(),
        "-n".into(),
        limit_str,
    ];
    if skip > 0 {
        args.push("--skip".into());
        args.push(skip_str);
    }
    filters.apply(&mut args);
    if let Some(b) = branch {
        args.push(b.to_string());
    }
    filters.apply_path(&mut args);

    let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let output = git.run_ok(repo, &arg_refs)?;
    let raw: Vec<RawCommit> = output
        .split("\x00END\n")
        .filter(|s| !s.is_empty())
        .filter_map(parse_raw_commit)
        .collect();

    Ok(build_graph_rows(raw))
}

/// Distinct commit authors for the User filter dropdown.
pub fn log_authors(repo: &Path, git: &GitCli, branch: Option<&str>) -> Result<Vec<String>> {
    let mut args: Vec<String> = vec![
        "log".into(),
        "--format=%an".into(),
        "-n".into(),
        "4000".into(),
    ];
    if let Some(b) = branch {
        args.push(b.to_string());
    }
    let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let output = git.run_ok(repo, &arg_refs)?;
    let mut seen = std::collections::HashSet::new();
    let mut authors: Vec<String> = Vec::new();
    for line in output.lines() {
        let name = line.trim();
        if name.is_empty() {
            continue;
        }
        if seen.insert(name.to_string()) {
            authors.push(name.to_string());
        }
    }
    authors.sort_by_key(|a| a.to_lowercase());
    Ok(authors)
}

/// Local and remote branches that contain the given commit.
pub fn branches_containing(repo: &Path, git: &GitCli, hash: &str) -> Result<Vec<String>> {
    let output = git.run_ok(
        repo,
        &[
            "branch",
            "-a",
            "--contains",
            hash,
            "--format=%(refname:short)",
        ],
    )?;
    Ok(output
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty() && !l.contains("HEAD"))
        .map(|l| l.to_string())
        .collect())
}

fn parse_refs(decoration: &str) -> Vec<CommitRef> {
    let mut refs = Vec::new();
    for raw in decoration.split(',') {
        let token = raw.trim();
        if token.is_empty() {
            continue;
        }
        // "HEAD -> refs/heads/master"
        if let Some(rest) = token.strip_prefix("HEAD -> ") {
            refs.push(CommitRef {
                name: strip_ref_prefix(rest),
                kind: "head".into(),
            });
            continue;
        }
        if token == "HEAD" {
            refs.push(CommitRef {
                name: "HEAD".into(),
                kind: "head".into(),
            });
            continue;
        }
        if let Some(tag) = token.strip_prefix("tag: ") {
            refs.push(CommitRef {
                name: strip_ref_prefix(tag),
                kind: "tag".into(),
            });
            continue;
        }
        if token.starts_with("refs/remotes/") {
            refs.push(CommitRef {
                name: token.trim_start_matches("refs/remotes/").to_string(),
                kind: "remote".into(),
            });
        } else if token.starts_with("refs/heads/") {
            refs.push(CommitRef {
                name: token.trim_start_matches("refs/heads/").to_string(),
                kind: "local".into(),
            });
        } else if token.starts_with("refs/tags/") {
            refs.push(CommitRef {
                name: token.trim_start_matches("refs/tags/").to_string(),
                kind: "tag".into(),
            });
        } else {
            refs.push(CommitRef {
                name: token.to_string(),
                kind: "local".into(),
            });
        }
    }
    refs
}

fn strip_ref_prefix(name: &str) -> String {
    name.trim_start_matches("refs/heads/")
        .trim_start_matches("refs/remotes/")
        .trim_start_matches("refs/tags/")
        .to_string()
}

fn parse_raw_commit(block: &str) -> Option<RawCommit> {
    let block = block.strip_prefix('\n').unwrap_or(block);
    let parts: Vec<&str> = block.split('\x00').collect();
    if parts.len() < 7 {
        return None;
    }
    Some(RawCommit {
        hash: parts[0].to_string(),
        parents: parts[1]
            .split_whitespace()
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .collect(),
        author: parts[2].to_string(),
        email: parts[3].to_string(),
        date: parts[4].parse().unwrap_or(0),
        subject: parts[5].to_string(),
        refs: parse_refs(parts[6]),
        body: parts.get(7).unwrap_or(&"").trim_end().to_string(),
    })
}

struct RawCommit {
    hash: String,
    parents: Vec<String>,
    author: String,
    email: String,
    date: i64,
    subject: String,
    body: String,
    refs: Vec<CommitRef>,
}

/// Builds an IntelliJ-style commit graph: one node circle per row plus the
/// connecting line segments (straight, diagonal, merge and fork edges) that
/// link a commit to its parents and children across adjacent rows.
fn build_graph_rows(commits: Vec<RawCommit>) -> Vec<CommitEntry> {
    // Each lane holds the hash of the commit it is currently waiting to reach.
    let mut lanes: Vec<Option<String>> = Vec::new();
    let mut color_map: HashMap<String, usize> = HashMap::new();
    let mut next_color = 0usize;
    let mut result = Vec::new();

    for commit in commits {
        // Ensure this commit occupies a lane (tips with no loaded children get a fresh lane).
        let node_lane = match lanes
            .iter()
            .position(|l| l.as_deref() == Some(commit.hash.as_str()))
        {
            Some(i) => i,
            None => {
                lanes.push(Some(commit.hash.clone()));
                lanes.len() - 1
            }
        };
        let node_color = *color_map.entry(commit.hash.clone()).or_insert_with(|| {
            let c = next_color;
            next_color += 1;
            c
        });

        // `top` is the lane state entering this row (top anchors of the edges).
        let top = lanes.clone();
        let top_width = top.len();

        // Compute the bottom state: clear every lane that resolved to this commit
        // (the node lane plus any children converging in), then route the parents.
        let mut bottom: Vec<Option<String>> = top.clone();
        for l in bottom.iter_mut() {
            if l.as_deref() == Some(commit.hash.as_str()) {
                *l = None;
            }
        }

        let mut parent_slots: Vec<usize> = Vec::new();
        for (i, parent) in commit.parents.iter().enumerate() {
            if i == 0 {
                bottom[node_lane] = Some(parent.clone());
                color_map.entry(parent.clone()).or_insert(node_color);
                parent_slots.push(node_lane);
            } else {
                color_map.entry(parent.clone()).or_insert_with(|| {
                    let c = next_color;
                    next_color += 1;
                    c
                });
                let slot = match bottom.iter().position(|l| l.is_none()) {
                    Some(free) => {
                        bottom[free] = Some(parent.clone());
                        free
                    }
                    None => {
                        bottom.push(Some(parent.clone()));
                        bottom.len() - 1
                    }
                };
                parent_slots.push(slot);
            }
        }

        // Compact the bottom state (drop empty lanes) and remember the mapping
        // from uncompacted slot index -> compacted lane index.
        let mut slot_to_lane: Vec<Option<usize>> = vec![None; bottom.len()];
        let mut compacted: Vec<Option<String>> = Vec::new();
        for (i, l) in bottom.iter().enumerate() {
            if l.is_some() {
                slot_to_lane[i] = Some(compacted.len());
                compacted.push(l.clone());
            }
        }

        let color_hex = |idx: usize| lane_color(idx);
        let color_of = |hash: &str| color_map.get(hash).copied().unwrap_or(0);

        let mut edges: Vec<GraphEdge> = Vec::new();

        // Upper half (top edge -> node center / bottom).
        for (i, l) in top.iter().enumerate() {
            match l.as_deref() {
                Some(h) if h == commit.hash.as_str() => {
                    // A lane reaching this commit converges into the node.
                    edges.push(GraphEdge {
                        from_lane: i,
                        from_y: 0,
                        to_lane: node_lane,
                        to_y: 1,
                        color: color_hex(node_color),
                    });
                }
                Some(h) => {
                    // An unrelated lane passes straight through to its bottom slot.
                    if let Some(j) = slot_to_lane[i] {
                        edges.push(GraphEdge {
                            from_lane: i,
                            from_y: 0,
                            to_lane: j,
                            to_y: 2,
                            color: color_hex(color_of(h)),
                        });
                    }
                }
                None => {}
            }
        }

        // Lower half (node center -> each parent's bottom lane).
        for (k, parent) in commit.parents.iter().enumerate() {
            if let Some(j) = slot_to_lane[parent_slots[k]] {
                edges.push(GraphEdge {
                    from_lane: node_lane,
                    from_y: 1,
                    to_lane: j,
                    to_y: 2,
                    color: color_hex(color_of(parent)),
                });
            }
        }

        let width = top_width.max(compacted.len()).max(node_lane + 1);

        lanes = compacted;

        result.push(CommitEntry {
            short_hash: commit.hash.chars().take(7).collect(),
            hash: commit.hash,
            parents: commit.parents.clone(),
            author: commit.author,
            email: commit.email,
            date: commit.date,
            subject: commit.subject,
            body: commit.body,
            refs: commit.refs,
            graph_row: GraphRow {
                node_lane,
                node_color: color_hex(node_color),
                is_merge: commit.parents.len() > 1,
                width,
                edges,
            },
        });
    }

    result
}

pub fn log_count(
    repo: &Path,
    git: &GitCli,
    branch: Option<&str>,
    filters: &LogFilters,
) -> Result<u32> {
    let mut args: Vec<String> = vec!["rev-list".into(), "--count".into()];
    filters.apply(&mut args);
    args.push(branch.unwrap_or("HEAD").to_string());
    filters.apply_path(&mut args);
    let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let output = git.run_ok(repo, &arg_refs)?;
    output
        .trim()
        .parse()
        .map_err(|_| crate::RebasedError::other("invalid rev-list count"))
}

const LANE_COLORS: [&str; 8] = [
    "#3574F0", "#499C54", "#CC7832", "#9876AA", "#6897BB", "#FFC66D", "#CF5656", "#6A8759",
];

fn lane_color(index: usize) -> String {
    LANE_COLORS[index % LANE_COLORS.len()].to_string()
}
