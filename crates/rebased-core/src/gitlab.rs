use crate::{GitLabAccount, MergeRequestEntry, Result};

pub fn list_merge_requests(
    account: &GitLabAccount,
    project: &str,
) -> Result<Vec<MergeRequestEntry>> {
    let encoded = urlencoding::encode(project);
    let host = account.host.trim_end_matches('/');
    let url = format!("{host}/api/v4/projects/{encoded}/merge_requests?state=opened&per_page=50");
    let response = ureq::get(&url)
        .set("PRIVATE-TOKEN", &account.token)
        .set("User-Agent", "rebased-app")
        .call()
        .map_err(|e| crate::RebasedError::other(e.to_string()))?;

    let items: Vec<serde_json::Value> = response
        .into_json()
        .map_err(|e| crate::RebasedError::other(e.to_string()))?;

    Ok(items
        .into_iter()
        .filter_map(|item| {
            Some(MergeRequestEntry {
                iid: item.get("iid")?.as_u64()?,
                title: item.get("title")?.as_str()?.to_string(),
                state: item.get("state")?.as_str()?.to_string(),
                author: item.get("author")?.get("username")?.as_str()?.to_string(),
                url: item.get("web_url")?.as_str()?.to_string(),
                source_branch: item.get("source_branch")?.as_str()?.to_string(),
                target_branch: item.get("target_branch")?.as_str()?.to_string(),
            })
        })
        .collect())
}

pub fn verify_gitlab_token(account: &GitLabAccount) -> Result<String> {
    let host = account.host.trim_end_matches('/');
    let response = ureq::get(&format!("{host}/api/v4/user"))
        .set("PRIVATE-TOKEN", &account.token)
        .set("User-Agent", "rebased-app")
        .call()
        .map_err(|e| crate::RebasedError::other(e.to_string()))?;
    let json: serde_json::Value = response
        .into_json()
        .map_err(|e| crate::RebasedError::other(e.to_string()))?;
    json.get("username")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| crate::RebasedError::other("invalid gitlab token"))
}
