use std::path::Path;

use crate::{GitCli, Result, StashEntry};

pub fn list_stashes(repo: &Path, git: &GitCli) -> Result<Vec<StashEntry>> {
    let output = git.run_ok(repo, &["stash", "list", "--format=%gd%x00%s"]) ;
    match output {
        Ok(text) if !text.is_empty() => {
            let mut entries = Vec::new();
            for (i, line) in text.lines().enumerate() {
                let parts: Vec<&str> = line.split('\x00').collect();
                let message = parts.get(1).unwrap_or(&"").to_string();
                let branch = message
                    .split(": ")
                    .next()
                    .unwrap_or("stash")
                    .trim_start_matches("WIP on ")
                    .to_string();
                entries.push(StashEntry {
                    index: i as u32,
                    message,
                    branch,
                });
            }
            Ok(entries)
        }
        _ => Ok(Vec::new()),
    }
}

pub fn stash_push(repo: &Path, git: &GitCli, message: Option<&str>) -> Result<()> {
    match message {
        Some(m) => git.run_ok(repo, &["stash", "push", "-m", m])?,
        None => git.run_ok(repo, &["stash", "push"])?,
    };
    Ok(())
}

pub fn stash_pop(repo: &Path, git: &GitCli, index: u32) -> Result<()> {
    git.run_ok(repo, &["stash", "pop", &format!("stash@{{{index}}}")])?;
    Ok(())
}

pub fn stash_apply(repo: &Path, git: &GitCli, index: u32) -> Result<()> {
    git.run_ok(repo, &["stash", "apply", &format!("stash@{{{index}}}")])?;
    Ok(())
}

pub fn stash_drop(repo: &Path, git: &GitCli, index: u32) -> Result<()> {
    git.run_ok(repo, &["stash", "drop", &format!("stash@{{{index}}}")])?;
    Ok(())
}
