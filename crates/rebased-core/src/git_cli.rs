use std::path::Path;
use std::process::{Command, Output};

use crate::{RebasedError, Result};

#[derive(Debug, Clone)]
pub struct GitCli {
    pub git_path: String,
}

impl Default for GitCli {
    fn default() -> Self {
        Self {
            git_path: "git".into(),
        }
    }
}

impl GitCli {
    pub fn new(git_path: impl Into<String>) -> Self {
        Self {
            git_path: git_path.into(),
        }
    }

    pub fn run(&self, repo: &Path, args: &[&str]) -> Result<Output> {
        let output = Command::new(&self.git_path)
            .current_dir(repo)
            .args(args)
            .output()?;
        Ok(output)
    }

    pub fn run_ok(&self, repo: &Path, args: &[&str]) -> Result<String> {
        let output = self.run(repo, args)?;
        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
        } else {
            Err(RebasedError::git(format!(
                "git {} failed: {}",
                args.join(" "),
                String::from_utf8_lossy(&output.stderr).trim()
            )))
        }
    }

    pub fn run_allow_fail(&self, repo: &Path, args: &[&str]) -> Result<(bool, String, String)> {
        let output = self.run(repo, args)?;
        Ok((
            output.status.success(),
            String::from_utf8_lossy(&output.stdout).to_string(),
            String::from_utf8_lossy(&output.stderr).to_string(),
        ))
    }

    pub fn run_ok_bytes(&self, repo: &Path, args: &[&str]) -> Result<Vec<u8>> {
        let output = self.run(repo, args)?;
        if output.status.success() {
            Ok(output.stdout)
        } else {
            Err(RebasedError::git(format!(
                "git {} failed: {}",
                args.join(" "),
                String::from_utf8_lossy(&output.stderr).trim()
            )))
        }
    }
}
