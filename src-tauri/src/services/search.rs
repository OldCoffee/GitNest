use std::fs;
use std::path::Path;
use std::sync::atomic::AtomicBool;

use ignore::WalkBuilder;
use regex::{Regex, RegexBuilder};
use serde::Serialize;

use super::TaskScheduler;

const MAX_SEARCH_FILE_BYTES: u64 = 2 * 1024 * 1024;
const MAX_RESULTS: usize = 5_000;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchMatch {
    pub path: String,
    pub line: u32,
    pub column: u32,
    pub preview: String,
}

#[derive(Default)]
pub struct SearchService;

impl SearchService {
    pub fn compile(query: &str, case_sensitive: bool, use_regex: bool) -> Result<Regex, String> {
        let pattern = if use_regex {
            query.to_string()
        } else {
            regex::escape(query)
        };
        RegexBuilder::new(&pattern)
            .case_insensitive(!case_sensitive)
            .build()
            .map_err(|error| error.to_string())
    }

    pub fn search(
        root: &Path,
        query: &Regex,
        file_names_only: bool,
        canceled: &AtomicBool,
        mut on_batch: impl FnMut(Vec<SearchMatch>),
    ) -> Result<usize, String> {
        let mut total = 0usize;
        let mut batch = Vec::with_capacity(64);

        for entry in WalkBuilder::new(root)
            .hidden(false)
            .git_ignore(true)
            .git_global(true)
            .git_exclude(true)
            .build()
            .filter_map(Result::ok)
        {
            if TaskScheduler::is_canceled(canceled) || total >= MAX_RESULTS {
                break;
            }
            let path = entry.path();
            if !path.is_file() || path.components().any(|part| part.as_os_str() == ".git") {
                continue;
            }
            let relative = path
                .strip_prefix(root)
                .unwrap_or(path)
                .to_string_lossy()
                .replace('\\', "/");

            if file_names_only {
                if let Some(found) = query.find(&relative) {
                    let column = found.start() as u32;
                    batch.push(SearchMatch {
                        path: relative,
                        line: 0,
                        column,
                        preview: String::new(),
                    });
                    total += 1;
                }
            } else {
                let metadata = match fs::metadata(path) {
                    Ok(metadata) if metadata.len() <= MAX_SEARCH_FILE_BYTES => metadata,
                    _ => continue,
                };
                if metadata.len() == 0 {
                    continue;
                }
                let content = match fs::read_to_string(path) {
                    Ok(content) => content,
                    Err(_) => continue,
                };
                for (line_index, line) in content.lines().enumerate() {
                    if let Some(found) = query.find(line) {
                        batch.push(SearchMatch {
                            path: relative.clone(),
                            line: (line_index + 1) as u32,
                            column: found.start() as u32,
                            preview: line.trim().chars().take(240).collect(),
                        });
                        total += 1;
                        if total >= MAX_RESULTS {
                            break;
                        }
                    }
                }
            }

            if batch.len() >= 64 {
                on_batch(std::mem::take(&mut batch));
            }
        }
        if !batch.is_empty() {
            on_batch(batch);
        }
        Ok(total)
    }
}
