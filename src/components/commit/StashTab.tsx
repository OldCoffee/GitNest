import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useState } from "react";
import { api } from "../../lib/api";
import { useAppStore } from "../../store/appStore";
import { useT } from "../../context/PreferencesContext";
import { Button, EmptyState, Input, Loading, ToolbarStrip } from "../ui";

export function StashTab() {
  const t = useT();
  const appendVcsOutput = useAppStore((s) => s.appendVcsOutput);
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);

  const { data: stashes = [], isLoading } = useQuery({
    queryKey: ["stashes"],
    queryFn: api.listStashes,
  });

  const virtualizer = useVirtualizer({
    count: stashes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 8,
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["stashes"] });
    await queryClient.invalidateQueries({ queryKey: ["status"] });
  }

  async function run(action: () => Promise<void>, label: string) {
    setBusy(true);
    try {
      await action();
      appendVcsOutput(t("common.actionCompleted", { action: label }));
      await refresh();
    } catch (e) {
      appendVcsOutput(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ToolbarStrip>
        <Input
          className="flex-1 text-xs"
          placeholder={t("commit.stashMessage")}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <Button
          disabled={busy}
          onClick={() =>
            run(() => api.stashPush(message.trim() || null), t("stashOps.push"))
          }
        >
          {t("commit.stashAction")}
        </Button>
      </ToolbarStrip>

      {isLoading && <Loading />}

      <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
        {stashes.length === 0 && !isLoading && (
          <EmptyState>{t("commit.noStashes")}</EmptyState>
        )}
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
          {virtualizer.getVirtualItems().map((row) => {
            const stash = stashes[row.index];
            return (
              <div
                key={stash.index}
                className="jb-list-row"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${row.start}px)`,
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs">{stash.message}</div>
                  <div className="text-xs jb-text-dim">
                    stash@{"{" + stash.index + "}"} · {stash.branch}
                  </div>
                </div>
                <Button
                  disabled={busy}
                  onClick={() => run(() => api.stashPop(stash.index), t("stashOps.pop"))}
                >
                  {t("commit.pop")}
                </Button>
                <Button
                  disabled={busy}
                  onClick={() => run(() => api.stashApply(stash.index), t("stashOps.apply"))}
                >
                  {t("commit.apply")}
                </Button>
                <Button
                  disabled={busy}
                  onClick={() => run(() => api.stashDrop(stash.index), t("stashOps.drop"))}
                >
                  {t("commit.drop")}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
