import { expect, test } from "@playwright/test";
import { installTauriMock } from "./tauriMock";

test("main path: open → stage → commit → log", async ({ page }) => {
  await installTauriMock(page);
  await page.goto("/");

  await expect(page.getByTestId("welcome-recent-open")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("welcome-recent-open").first().click();

  await expect(page.getByTestId("repo-switcher")).toBeVisible({ timeout: 30_000 });

  // Open Git tool window (Commit / Local Changes).
  await page.getByTestId("activity-git").click();
  await expect(page.getByTestId("stage-button")).toBeVisible({ timeout: 15_000 });

  await page.getByTestId("stage-button").click();
  await page.getByTestId("commit-subject").fill("e2e: main path commit");
  await page.getByTestId("commit-button").click();

  await page.getByTestId("toolbar-log").click();
  const logList = page.getByTestId("log-list");
  await expect(logList).toBeVisible({ timeout: 15_000 });
  await expect(logList.getByText("e2e: main path commit")).toBeVisible();
});
