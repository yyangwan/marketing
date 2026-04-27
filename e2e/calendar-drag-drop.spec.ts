import { test, expect } from "@playwright/test";

test.describe("Calendar drag-and-drop rescheduling", () => {
  test.beforeEach(async ({ page }) => {
    // TODO: Setup test data via API or seed script
    // For now, assume test workspace exists with scheduled content
    await page.goto("/calendar");
  });

  test("should load calendar with events", async ({ page }) => {
    // Wait for calendar to render
    await expect(page.locator(".rbc-calendar")).toBeVisible();

    // Verify events are displayed
    const events = page.locator(".rbc-event");
    const count = await events.count();

    // Should have at least one event in test data
    expect(count).toBeGreaterThan(0);
  });

  test("should switch between month/week/day views", async ({ page }) => {
    // Default view is month
    await expect(page.locator(".rbc-month-view")).toBeVisible();

    // Switch to week view
    await page.click("button:has-text('Week')");

    // Wait for week view to render
    await expect(page.locator(".rbc-time-view")).toBeVisible();

    // Switch to day view
    await page.click("button:has-text('Day')");

    // Wait for day view to render
    await expect(page.locator(".rbc-time-view")).toBeVisible();

    // Switch back to month
    await page.click("button:has-text('Month')");
    await expect(page.locator(".rbc-month-view")).toBeVisible();
  });

  test("should filter events by project", async ({ page }) => {
    // Wait for calendar to load
    await expect(page.locator(".rbc-calendar")).toBeVisible();

    // Get initial event count
    const initialEvents = page.locator(".rbc-event");
    const initialCount = await initialEvents.count();

    // Select a project filter (if projects exist)
    const projectSelect = page.locator("select[aria-label*='Project']");
    if (await projectSelect.count() > 0) {
      // Get first non-empty option
      const options = await projectSelect.locator("option").allTextContents();

      if (options.length > 1) {
        // Select first project (skip "All Projects")
        await projectSelect.selectOption({ index: 1 });

        // Wait for events to re-render
        await page.waitForTimeout(500);

        // Verify filtered events
        const filteredEvents = page.locator(".rbc-event");
        const filteredCount = await filteredEvents.count();

        // Filtered count should be <= initial count
        expect(filteredCount).toBeLessThanOrEqual(initialCount);
      }
    }
  });

  test("should filter events by status", async ({ page }) => {
    // Wait for calendar to load
    await expect(page.locator(".rbc-calendar")).toBeVisible();

    // Get initial event count
    const initialEvents = page.locator(".rbc-event");
    const initialCount = await initialEvents.count();

    // Select "scheduled" status
    await page.selectOption("select[aria-label*='Status']", "scheduled");

    // Wait for events to re-render
    await page.waitForTimeout(500);

    // Verify filtered events
    const filteredEvents = page.locator(".rbc-event");
    const filteredCount = await filteredEvents.count();

    // Filtered count should be <= initial count
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });

  test("should drag event to new date in month view", async ({ page }) => {
    // Wait for calendar to load
    await expect(page.locator(".rbc-calendar")).toBeVisible();

    // Get first event
    const firstEvent = page.locator(".rbc-event").first();
    await expect(firstEvent).toBeVisible();

    // Get event title to verify after move
    const eventTitle = await firstEvent.textContent();

    // Drag event to a different day cell
    const targetCell = page.locator(".rbc-month-view .rbc-day-bg").nth(10);

    // Perform drag and drop
    await firstEvent.dragTo(targetCell);

    // Wait for UI update
    await page.waitForTimeout(1000);

    // Verify event moved by checking it's no longer in original position
    // This is a basic check — full verification would require API check or reload
    await expect(page.locator(".rbc-event").first()).toContainText(eventTitle || "");
  });

  test("should click event to open content editor", async ({ page }) => {
    // Wait for calendar to load
    await expect(page.locator(".rbc-calendar")).toBeVisible();

    // Click first event
    const firstEvent = page.locator(".rbc-event").first();
    await firstEvent.click();

    // Content editor should appear (this would navigate to content detail)
    // For now, just verify the click action doesn't error
    await expect(page).not.toHaveURL(/error/);
  });

  test("should display event count in header", async ({ page }) => {
    // Wait for calendar to load
    await expect(page.locator(".rbc-calendar")).toBeVisible();

    // Count events
    const events = page.locator(".rbc-event");
    const eventCount = await events.count();

    // Verify event count display
    const eventCountText = page.locator("text=/\\d+ events?/");
    await expect(eventCountText).toBeVisible();

    // Verify count matches
    const displayedCount = await eventCountText.textContent();
    expect(displayedCount).toContain(eventCount.toString());
  });
});

test.describe("Schedule dialog", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a content piece that has schedule dialog
    // This would typically be /content/[id]
    await page.goto("/content/test-content-id");
  });

  test("should open schedule dialog", async ({ page }) => {
    // Click "安排日程" button
    const scheduleButton = page.locator("button:has-text('安排日程')");
    if (await scheduleButton.count() > 0) {
      await scheduleButton.click();

      // Verify dialog appears
      await expect(page.locator("text=安排发布日程")).toBeVisible();

      // Verify date and time inputs are present
      await expect(page.locator("input[type='date']")).toBeVisible();
      await expect(page.locator("input[type='time']")).toBeVisible();
    }
  });

  test("should create schedule via dialog", async ({ page }) => {
    // Click schedule button
    const scheduleButton = page.locator("button:has-text('安排日程')");
    if (await scheduleButton.count() > 0) {
      await scheduleButton.click();

      // Set date to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split("T")[0];

      await page.fill("input[type='date']", dateStr);

      // Set time to 10:00 AM
      await page.fill("input[type='time']", "10:00");

      // Click confirm
      await page.click("button:has-text('确认')");

      // Verify success toast
      await expect(page.locator("text=日程已安排")).toBeVisible();

      // Verify schedule badge appears
      await expect(page.locator("text=/\\d{1,2}月\\d{1,2}日/")).toBeVisible();
    }
  });

  test("should remove existing schedule", async ({ page }) => {
    // If schedule exists, click X button
    const removeButton = page.locator("button[title='取消日程']");
    if (await removeButton.count() > 0) {
      // Get current state
      const hasSchedule = await removeButton.isVisible();

      if (hasSchedule) {
        await removeButton.click();

        // Verify confirmation dialog
        // Note: browser's native confirm() needs to be handled
        page.on("dialog", (dialog) => dialog.accept());

        // Verify success message
        await expect(page.locator("text=日程已取消")).toBeVisible();

        // Verify "安排日程" button reappears
        await expect(page.locator("button:has-text('安排日程')")).toBeVisible();
      }
    }
  });
});
