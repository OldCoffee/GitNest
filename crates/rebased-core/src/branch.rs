use std::path::Path;

use crate::{BranchInfo, GitCli, Result};

pub fn list_branches(repo: &Path, git: &GitCli) -> Result<Vec<BranchInfo>> {
    let current = git
        .run_ok(repo, &["branch", "--show-current"])
        .unwrap_or_default();
    let current_upstream = git
        .run_ok(repo, &["rev-parse", "--abbrev-ref", "@{u}"])
        .unwrap_or_default();

    let output = git.run_ok(
        repo,
        &[
            "for-each-ref",
            "--format=%(refname:short)%00%(upstream:short)%00%(objectname:short)%00%(refname)%00%(upstream:trackshort)",
            "refs/heads",
            "refs/remotes",
        ],
    )?;

    let mut branches = Vec::new();
    for line in output.lines() {
        let parts: Vec<&str> = line.split('\x00').collect();
        if parts.len() < 4 {
            continue;
        }
        let name = parts[0].to_string();
        let refname = parts[3];
        let is_remote = refname.starts_with("refs/remotes/");
        if is_remote && (name.ends_with("/HEAD") || name.split('/').nth(1) == Some("HEAD")) {
            continue;
        }
        let upstream = parts.get(1).filter(|s| !s.is_empty()).map(|s| s.to_string());
        let last_commit = parts.get(2).filter(|s| !s.is_empty()).map(|s| s.to_string());
        let track_short = parts.get(4).unwrap_or(&"");
        let (ahead, behind) = if is_remote {
            (0, 0)
        } else {
            parse_upstream_track_short(track_short)
        };
        let is_current = if is_remote {
            !current_upstream.is_empty() && name == current_upstream
        } else {
            name == current
        };

        branches.push(BranchInfo {
            name,
            is_remote,
            is_current,
            upstream,
            last_commit,
            ahead,
            behind,
        });
    }
    Ok(branches)
}

fn parse_upstream_track_short(track: &str) -> (u32, u32) {
    let mut ahead = 0u32;
    let mut behind = 0u32;
    let trimmed = track.trim();
    if trimmed.is_empty() {
        return (ahead, behind);
    }
    let inner = trimmed
        .strip_prefix('[')
        .and_then(|s| s.strip_suffix(']'))
        .unwrap_or(trimmed);
    for segment in inner.split(',') {
        let segment = segment.trim();
        if let Some(rest) = segment.strip_prefix("ahead ") {
            ahead = rest.trim().parse().unwrap_or(0);
        } else if let Some(rest) = segment.strip_prefix("behind ") {
            behind = rest.trim().parse().unwrap_or(0);
        }
    }
    (ahead, behind)
}

#[cfg(test)]
mod tests {
    use super::parse_upstream_track_short;

    #[test]
    fn parse_track_short_behind_only() {
        assert_eq!(parse_upstream_track_short("[behind 2]"), (0, 2));
    }

    #[test]
    fn parse_track_short_ahead_and_behind() {
        assert_eq!(parse_upstream_track_short("[ahead 1, behind 3]"), (1, 3));
    }

    #[test]
    fn parse_track_short_empty() {
        assert_eq!(parse_upstream_track_short(""), (0, 0));
    }
}

pub fn checkout(repo: &Path, git: &GitCli, branch: &str) -> Result<()> {
    if is_remote_shorthand(branch) {
        checkout_remote_tracking(repo, git, branch)
    } else {
        git.run_ok(repo, &["checkout", branch])?;
        Ok(())
    }
}

fn is_remote_shorthand(name: &str) -> bool {
    name.contains('/') && !name.starts_with("refs/")
}

fn checkout_remote_tracking(repo: &Path, git: &GitCli, remote_branch: &str) -> Result<()> {
    let local_name = remote_branch
        .split_once('/')
        .map(|(_, rest)| rest)
        .filter(|rest| !rest.is_empty() && *rest != "HEAD")
        .ok_or_else(|| crate::RebasedError::other("invalid remote branch name"))?;

    let local_exists = list_branches(repo, git)?
        .iter()
        .any(|b| !b.is_remote && b.name == local_name);

    if local_exists {
        git.run_ok(repo, &["checkout", local_name])?;
    } else {
        git.run_ok(repo, &["checkout", "-b", local_name, "--track", remote_branch])?;
    }
    Ok(())
}

pub fn create_branch(repo: &Path, git: &GitCli, name: &str) -> Result<()> {
    git.run_ok(repo, &["branch", name])?;
    Ok(())
}

pub fn create_branch_from(
    repo: &Path,
    git: &GitCli,
    name: &str,
    start_point: &str,
) -> Result<()> {
    git.run_ok(repo, &["branch", name, start_point])?;
    Ok(())
}

pub fn rename_branch(repo: &Path, git: &GitCli, old: &str, new: &str) -> Result<()> {
    git.run_ok(repo, &["branch", "-m", old, new])?;
    Ok(())
}

pub fn checkout_and_rebase(repo: &Path, git: &GitCli, branch: &str, onto: &str) -> Result<()> {
    checkout(repo, git, branch)?;
    git.run_ok(repo, &["rebase", onto])?;
    Ok(())
}

pub fn rebase_branch_onto(
    repo: &Path,
    git: &GitCli,
    base_branch: &str,
    onto_branch: &str,
) -> Result<()> {
    checkout(repo, git, base_branch)?;
    git.run_ok(repo, &["rebase", onto_branch])?;
    Ok(())
}

pub fn merge_branch_into(
    repo: &Path,
    git: &GitCli,
    into_branch: &str,
    from_branch: &str,
) -> Result<()> {
    checkout(repo, git, into_branch)?;
    git.run_ok(repo, &["merge", from_branch])?;
    Ok(())
}

pub fn update_branch(repo: &Path, git: &GitCli, branch: &str) -> Result<String> {
    checkout(repo, git, branch)?;
    let upstream = git
        .run_ok(repo, &["rev-parse", "--abbrev-ref", "@{u}"])
        .map_err(|_| {
            crate::RebasedError::other(format!(
                "branch '{branch}' has no upstream configured"
            ))
        })?;
    git.run_ok(repo, &["fetch"])?;
    git.run_ok(repo, &["merge", &upstream])?;
    Ok(format!("Updated '{branch}' from {upstream}"))
}

pub fn pull_remote_into(
    repo: &Path,
    git: &GitCli,
    into_branch: &str,
    remote_branch: &str,
    use_rebase: bool,
) -> Result<String> {
    let (remote, branch) = split_remote_branch(remote_branch)?;
    checkout(repo, git, into_branch)?;
    if use_rebase {
        git.run_ok(repo, &["pull", "--rebase", remote, branch])?;
    } else {
        git.run_ok(repo, &["pull", remote, branch])?;
    }
    Ok(format!(
        "Pulled {remote_branch} into '{into_branch}' using {}",
        if use_rebase { "rebase" } else { "merge" }
    ))
}

pub fn delete_remote_branch(repo: &Path, git: &GitCli, remote_branch: &str) -> Result<()> {
    let (remote, branch) = split_remote_branch(remote_branch)?;
    git.run_ok(repo, &["push", remote, &format!(":{branch}")])?;
    Ok(())
}

fn split_remote_branch(remote_branch: &str) -> Result<(&str, &str)> {
    remote_branch
        .split_once('/')
        .filter(|(_, rest)| !rest.is_empty() && *rest != "HEAD")
        .ok_or_else(|| crate::RebasedError::other("invalid remote branch name"))
}

pub fn delete_branch(repo: &Path, git: &GitCli, name: &str, force: bool) -> Result<()> {
    if name.contains('/') {
        return Err(crate::RebasedError::other(
            "cannot delete remote branches from local repository",
        ));
    }
    if force {
        git.run_ok(repo, &["branch", "-D", name])?;
    } else {
        git.run_ok(repo, &["branch", "-d", name])?;
    }
    Ok(())
}
