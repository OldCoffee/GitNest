import type { Page } from "@playwright/test";

/** Install a minimal Tauri invoke mock before the app boots. */
export async function installTauriMock(page: Page) {
  await page.addInitScript(() => {
    const REPO = {
      path: "/tmp/gitnest-e2e-repo",
      branch: "main",
      remotes: [{ name: "origin", url: "https://github.com/example/demo.git" }],
      is_bare: false,
    };

    let staged: Array<Record<string, unknown>> = [];
    let unstaged: Array<Record<string, unknown>> = [
      {
        path: "README.md",
        old_path: null,
        status: "modified",
        staged: false,
        additions: 1,
        deletions: 0,
      },
    ];
    const emptyGraph = {
      node_lane: 0,
      node_color: "#3D7EFF",
      is_merge: false,
      width: 1,
      edges: [],
    };
    const commits: Array<Record<string, unknown>> = [
      {
        hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        short_hash: "aaaaaaa",
        subject: "chore: init",
        body: "",
        author: "E2E",
        email: "e2e@test",
        date: Math.floor(Date.now() / 1000),
        refs: [{ name: "main", kind: "local" }],
        parents: [],
        graph_row: emptyGraph,
      },
    ];

    const settings = {
      schema_version: 1,
      git_path: "git",
      auto_fetch_minutes: 0,
      recent_repos: [REPO.path],
      default_remote: "origin",
      shell_path: "/bin/zsh",
      diff_mode: "unified",
      store_settings_in_project: false,
      confirm_discard: true,
      ui_theme: "dark",
      ui_language: "en",
      java_home: "",
      jdt_ls_path: "",
      maven_home: "",
      github_account: null,
      gitlab_account: null,
    };

    const handlers: Record<string, (args: Record<string, unknown>) => unknown> = {
      get_settings: () => settings,
      get_recent_repos: () => settings.recent_repos,
      get_desktop_smoke_config: () => null,
      get_perf_probe_config: () => null,
      is_git_repository: () => true,
      open_repository: () => REPO,
      get_repo_info: () => REPO,
      close_repository: () => undefined,
      project_has_java_markers: () => false,
      get_status: () => ({
        staged,
        unstaged,
        untracked: [],
        conflicted: [],
      }),
      get_branches: () => [
        {
          name: "main",
          is_current: true,
          is_remote: false,
          upstream: "origin/main",
          ahead: 0,
          behind: 0,
        },
      ],
      get_repo_operation_state: () => ({
        merging: false,
        merge_head: null,
        rebasing: false,
        cherry_picking: false,
        reverting: false,
        conflict_count: 0,
      }),
      list_workspace_roots: () => [REPO.path],
      add_workspace_folder: (args) => {
        const path = String(args.path ?? "");
        return path && path !== REPO.path ? [REPO.path, path] : [REPO.path];
      },
      remove_workspace_folder: () => [REPO.path],
      list_project_entries: () => [
        { name: "README.md", path: "README.md", is_dir: false, git_ignored: false },
      ],
      list_project_tree: () => [
        {
          name: "README.md",
          path: "README.md",
          is_dir: false,
          git_ignored: false,
          depth: 0,
        },
      ],
      read_project_file_text: () => ({
        content: "# Demo\n",
        is_binary: false,
        too_large: false,
        size_bytes: 7,
      }),
      write_project_file_text: () => undefined,
      create_project_file: () => undefined,
      stage_files: () => {
        staged = unstaged.map((f) => ({ ...f, staged: true }));
        unstaged = [];
      },
      stage_all_files: () => {
        staged = unstaged.map((f) => ({ ...f, staged: true }));
        unstaged = [];
      },
      unstage_files: () => undefined,
      unstage_all_files: () => undefined,
      get_commit_template: () => null,
      commit_changes: (args) => {
        const options = (args.options ?? {}) as { subject?: string; body?: string };
        const hash = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
        commits.unshift({
          hash,
          short_hash: "bbbbbbb",
          subject: options.subject ?? "e2e commit",
          body: options.body ?? "",
          author: "E2E",
          email: "e2e@test",
          date: Math.floor(Date.now() / 1000),
          refs: [{ name: "main", kind: "local" }],
          parents: [(commits[0]?.hash as string) ?? ""],
          graph_row: emptyGraph,
        });
        staged = [];
        return { hash, output: `[main bbbbbbb] ${options.subject ?? "e2e commit"}` };
      },
      get_log: () => commits,
      get_log_count: () => commits.length,
      get_log_authors: () => ["E2E"],
      get_remotes: () => REPO.remotes,
      get_process_stats: () => ({ memory_bytes: 1, cpu_percent: 0 }),
      open_new_window: () => undefined,
      terminal_close_all: () => 0,
      "plugin:opener|open_path": () => undefined,
      "plugin:opener|reveal_item_in_dir": () => undefined,
      "plugin:dialog|open": () => REPO.path,
    };

    (
      window as unknown as {
        __TAURI_INTERNALS__: {
          invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
          transformCallback: () => number;
          unregisterCallback: () => void;
        };
      }
    ).__TAURI_INTERNALS__ = {
      invoke(cmd: string, args: Record<string, unknown> = {}) {
        const handler = handlers[cmd];
        if (!handler) {
          console.warn("[e2e-mock] unhandled invoke", cmd, args);
          return Promise.resolve(null);
        }
        try {
          return Promise.resolve(handler(args ?? {}));
        } catch (error) {
          return Promise.reject(error);
        }
      },
      transformCallback() {
        return 0;
      },
      unregisterCallback() {},
    };
  });
}
