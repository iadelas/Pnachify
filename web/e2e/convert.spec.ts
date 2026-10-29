import { expect, test } from "@playwright/test";

test("converts pasted raw codes to a CRC-named pnach", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Cheat codes" })
    .fill("Max Money\n20000000 00000001");
  await page.getByRole("textbox", { name: "Game name" }).fill("Test Game");
  await page.getByRole("textbox", { name: "Game CRC" }).fill("0891B1D0");
  await page.getByRole("button", { name: "Convert to PNACH" }).click();

  const output = page.locator("textarea[readonly]");
  await expect(output).toContainText("gametitle=Test Game");
  await expect(output).toContainText("patch=1,EE,20000000,extended,00000001");
  await expect(page.getByText("Detected: RAW")).toBeVisible();
  await expect(page.getByText("How to put it on my phone")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("0891B1D0.pnach");
});

test("drops master codes and says so", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Cheat codes" })
    .fill("Masters\n90123456 0C078881\nMax Money\n20000000 00000001");
  await page.getByRole("button", { name: "Convert to PNACH" }).click();

  const output = page.locator("textarea[readonly]");
  await expect(output).toContainText("patch=1,EE,20000000,extended,00000001");
  await expect(output).not.toContainText("90123456");
  await expect(page.getByText(/Skipped the master/)).toBeVisible();
});

test("shows the manual format picker when nothing converts", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Cheat codes" }).fill("hello");
  await page.getByRole("button", { name: "Convert to PNACH" }).click();

  await expect(page.getByLabel("Pick the input format yourself")).toBeVisible();
});

test("convert another keeps the game fields and clears the codes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Cheat codes" }).fill("20000000 00000001");
  await page.getByRole("textbox", { name: "Game name" }).fill("Test Game");
  await page.getByRole("button", { name: "Convert to PNACH" }).click();
  await page.getByRole("button", { name: "Convert another list" }).click();

  await expect(page.getByRole("textbox", { name: "Cheat codes" })).toHaveValue("");
  await expect(page.getByRole("textbox", { name: "Game name" })).toHaveValue(
    "Test Game",
  );
});
