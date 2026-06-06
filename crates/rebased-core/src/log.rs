use std::collections::HashMap;
use std::path::Path;

use crate::{CommitEntry, GitCli, GraphLane, GraphRow, Result};

pub fn log_page(
    repo: &Path,
    git: &GitCli,
    branch: Option<&str>,
    skip: u32,
    limit: u32,
) -> Result<Vec<CommitEntry>> {
    let limit_str = limit.to_string();
    let skip_str = skip.to_string();
    let mut args: Vec<String> = vec![
        "log".into(),
        "--date=unix".into(),
        "--pretty=format:%H%x00%P%x00%an%x00%ae%x00%at%x00%s%x00%b%x00END".into(),
        "-n".into(),
        limit_str,
    ];
    if skip > 0 {
        args.push("--skip".into());
        args.push(skip_str);
    }
    if let Some(b) = branch {
        args.push(b.to_string());
    }

    let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let output = git.run_ok(repo, &arg_refs)?;
    let raw: Vec<RawCommit> = output
        .split("\x00END\n")
        .filter(|s| !s.is_empty())
        .filter_map(parse_raw_commit)
        .collect();

    Ok(build_graph_rows(raw))
}

fn parse_raw_commit(block: &str) -> Option<RawCommit> {
    let parts: Vec<&str> = block.split('\x00').collect();
    if parts.len() < 6 {
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
        body: parts.get(6).unwrap_or(&"").trim_end().to_string(),
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
}

fn build_graph_rows(commits: Vec<RawCommit>) -> Vec<CommitEntry> {
    let mut lanes: Vec<Option<String>> = Vec::new();
    let mut color_map: HashMap<String, usize> = HashMap::new();
    let mut next_color = 0usize;
    let mut result = Vec::new();

    for commit in commits {
        let color_index = *color_map.entry(commit.hash.clone()).or_insert_with(|| {
            let c = next_color;
            next_color += 1;
            c
        });

        // Find lane for this commit
        let lane_idx = lanes
            .iter()
            .position(|l| l.as_ref() == Some(&commit.hash))
            .unwrap_or_else(|| {
                lanes.push(Some(commit.hash.clone()));
                lanes.len() - 1
            });

        let marker = if commit.parents.is_empty() {
            "●"
        } else if commit.parents.len() > 1 {
            "◆"
        } else {
            "●"
        };

        let connector = "─".repeat(lane_idx + 1);
        let graph_lanes: Vec<GraphLane> = lanes
            .iter()
            .enumerate()
            .map(|(i, l)| {
                let idx = if i == lane_idx {
                    color_index
                } else {
                    l.as_ref()
                        .and_then(|h| color_map.get(h).copied())
                        .unwrap_or(i)
                };
                GraphLane {
                    color_index: idx,
                    active: l.is_some(),
                    color: lane_color(idx),
                }
            })
            .collect();

        // Update lanes for parents
        lanes[lane_idx] = None;
        for (i, parent) in commit.parents.iter().enumerate() {
            if i == 0 {
                if lane_idx < lanes.len() {
                    lanes[lane_idx] = Some(parent.clone());
                } else {
                    lanes.push(Some(parent.clone()));
                }
                color_map.insert(parent.clone(), color_index);
            } else {
                lanes.push(Some(parent.clone()));
                color_map.insert(parent.clone(), next_color);
                next_color += 1;
            }
        }
        lanes.retain(|l| l.is_some());

        result.push(CommitEntry {
            short_hash: commit.hash.chars().take(7).collect(),
            hash: commit.hash,
            parents: commit.parents,
            author: commit.author,
            email: commit.email,
            date: commit.date,
            subject: commit.subject,
            body: commit.body,
            graph_row: GraphRow {
                lanes: graph_lanes,
                connector,
                marker: marker.to_string(),
            },
        });
    }

    result
}

pub fn log_count(repo: &Path, git: &GitCli, branch: Option<&str>) -> Result<u32> {
    let mut args = vec!["rev-list", "--count", "HEAD"];
    if let Some(b) = branch {
        args.push(b);
    }
    let output = git.run_ok(repo, &args)?;
    output.parse().map_err(|_| crate::RebasedError::other("invalid rev-list count"))
}

const LANE_COLORS: [&str; 8] = [
    "#3574F0", "#499C54", "#CC7832", "#9876AA", "#6897BB", "#FFC66D", "#CF5656", "#6A8759",
];

fn lane_color(index: usize) -> String {
    LANE_COLORS[index % LANE_COLORS.len()].to_string()
}
