use crate::{GitHubAccount, PullRequestEntry, Result};

pub fn list_pull_requests(account: &GitHubAccount, repo: &str) -> Result<Vec<PullRequestEntry>> {
    let url = format!("https://api.github.com/repos/{repo}/pulls?state=open&per_page=50");
    let response = ureq::get(&url)
        .set("Authorization", &format!("Bearer {}", account.token))
        .set("User-Agent", "gitnest-app")
        .set("Accept", "application/vnd.github+json")
        .call()
        .map_err(|e| crate::RebasedError::other(e.to_string()))?;

    let items: Vec<serde_json::Value> = response
        .into_json()
        .map_err(|e| crate::RebasedError::other(e.to_string()))?;

    Ok(items
        .into_iter()
        .filter_map(|item| {
            Some(PullRequestEntry {
                number: item.get("number")?.as_u64()?,
                title: item.get("title")?.as_str()?.to_string(),
                state: item.get("state")?.as_str()?.to_string(),
                author: item.get("user")?.get("login")?.as_str()?.to_string(),
                url: item.get("html_url")?.as_str()?.to_string(),
                head: item.get("head")?.get("ref")?.as_str()?.to_string(),
                base: item.get("base")?.get("ref")?.as_str()?.to_string(),
            })
        })
        .collect())
}

pub fn verify_github_token(account: &GitHubAccount) -> Result<String> {
    let response = ureq::get("https://api.github.com/user")
        .set("Authorization", &format!("Bearer {}", account.token))
        .set("User-Agent", "gitnest-app")
        .set("Accept", "application/vnd.github+json")
        .call()
        .map_err(|e| crate::RebasedError::other(e.to_string()))?;
    let json: serde_json::Value = response
        .into_json()
        .map_err(|e| crate::RebasedError::other(e.to_string()))?;
    json.get("login")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| crate::RebasedError::other("invalid github token"))
}

pub fn create_pull_request(
    account: &GitHubAccount,
    repo: &str,
    options: &crate::CreatePullRequestOptions,
) -> Result<PullRequestEntry> {
    let url = format!("https://api.github.com/repos/{repo}/pulls");
    let body = serde_json::json!({
        "title": options.title,
        "body": options.body,
        "head": options.head,
        "base": options.base,
    });
    let response = ureq::post(&url)
        .set("Authorization", &format!("Bearer {}", account.token))
        .set("User-Agent", "gitnest-app")
        .set("Accept", "application/vnd.github+json")
        .send_json(body)
        .map_err(|e| crate::RebasedError::other(e.to_string()))?;
    let item: serde_json::Value = response
        .into_json()
        .map_err(|e| crate::RebasedError::other(e.to_string()))?;
    Ok(PullRequestEntry {
        number: item
            .get("number")
            .and_then(|v| v.as_u64())
            .ok_or_else(|| crate::RebasedError::other("create PR: missing number"))?,
        title: item
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or(&options.title)
            .to_string(),
        state: item
            .get("state")
            .and_then(|v| v.as_str())
            .unwrap_or("open")
            .to_string(),
        author: item
            .get("user")
            .and_then(|u| u.get("login"))
            .and_then(|v| v.as_str())
            .unwrap_or(&account.username)
            .to_string(),
        url: item
            .get("html_url")
            .and_then(|v| v.as_str())
            .ok_or_else(|| crate::RebasedError::other("create PR: missing html_url"))?
            .to_string(),
        head: options.head.clone(),
        base: options.base.clone(),
    })
}
