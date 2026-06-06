use std::path::PathBuf;

use thiserror::Error;

pub type Result<T> = std::result::Result<T, RebasedError>;

#[derive(Debug, Error)]
pub enum RebasedError {
    #[error("not a git repository: {0}")]
    NotARepository(PathBuf),
    #[error("git command failed: {0}")]
    GitCommand(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("{0}")]
    Other(String),
}

impl RebasedError {
    pub fn git(message: impl Into<String>) -> Self {
        Self::GitCommand(message.into())
    }

    pub fn other(message: impl Into<String>) -> Self {
        Self::Other(message.into())
    }
}
