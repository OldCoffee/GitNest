use std::path::{Path, PathBuf};

use crate::{GitCli, RemoteInfo, RepoInfo, Result, RebasedError};

pub struct Repository {
    pub path: PathBuf,
    git: GitCli,
}

impl Repository {
    pub fn open(path: impl AsRef<Path>, git: GitCli) -> Result<Self> {
        let path = path.as_ref().canonicalize()?;
        let git_dir = path.join(".git");
        if !git_dir.exists() {
            return Err(RebasedError::NotARepository(path));
        }
        Ok(Self { path, git })
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn git(&self) -> &GitCli {
        &self.git
    }

    pub fn info(&self) -> Result<RepoInfo> {
        let branch = self
            .git
            .run_ok(self.path(), &["branch", "--show-current"])
            .unwrap_or_else(|_| "HEAD".to_string());

        let is_bare = self
            .git
            .run_ok(self.path(), &["rev-parse", "--is-bare-repository"])
            .map(|s| s.trim() == "true")
            .unwrap_or(false);

        let mut remotes = Vec::new();
        if let Ok(remote_names) = self.git.run_ok(self.path(), &["remote"]) {
            for name in remote_names.lines().filter(|l| !l.is_empty()) {
                if let Ok(url) = self
                    .git
                    .run_ok(self.path(), &["remote", "get-url", name])
                {
                    remotes.push(RemoteInfo {
                        name: name.to_string(),
                        url,
                    });
                }
            }
        }

        Ok(RepoInfo {
            path: self.path.display().to_string(),
            branch,
            remotes,
            is_bare,
        })
    }
}

pub fn open_repo(path: impl AsRef<Path>, git_path: Option<&str>) -> Result<Repository> {
    let git = match git_path {
        Some(p) => GitCli::new(p),
        None => GitCli::default(),
    };
    Repository::open(path, git)
}
