use std::path::Path;

use crate::{CommitOptions, GitCli, Result};

pub fn commit(repo: &Path, git: &GitCli, options: &CommitOptions) -> Result<String> {
    let subject = options.subject.trim();
    if subject.is_empty() {
        return Err(crate::RebasedError::other("commit subject cannot be empty"));
    }
    let message = if options.body.trim().is_empty() {
        subject.to_string()
    } else {
        format!("{subject}\n\n{}", options.body.trim())
    };

    let mut args = vec!["commit", "-m", &message];
    if options.amend {
        args.push("--amend");
    }
    if options.signoff {
        args.push("--signoff");
    }
    git.run_ok(repo, &args)?;
    git.run_ok(repo, &["rev-parse", "--short", "HEAD"])
}
