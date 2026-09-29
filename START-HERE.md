# To-Do: capture, choose, focus

## Deploy

Export a task backup from your current app before updating. Deploy this complete source project to the same Vercel project and production address. Keep the existing password and Redis variables. No new service or manual database migration is needed. Refresh your open To-Do tabs after deployment.

Your card IDs, notes, claim links, flags, history, and local attachment database remain intact. Existing Focus and On deck selections become the first day's plan; other existing active cards remain in All tasks. Migration is saved with your next successful task change. Attachments remain local to the same browser and app address, outside JSON backups.

## Your daily loop

1. **Capture:** Type a title in the bottom bar and press Enter. Inbox is the default, and capture never replaces your focus. Choose Today only when you mean it. More details opens the existing card form, carrying over the title you typed. `/` focuses quick capture.
2. **Process Inbox:** Do today adds a task to today's plan. Open a card for Save for later (optionally with a review date), handoff, or completion. An empty Inbox means decisions have been made, not that everything is finished.
3. **Choose Today:** Start with roughly three meaningful outcomes. This is guidance, not a hard limit. Today contains only your deliberate selections. Focus, On deck, the periphery, and shuffle draw from that plan.
4. **Handle interruptions:** Make it now opens a short confirmation with an optional “where I left off” note. Switching adds the incoming task to Today and preserves the current task under Resume next. Complete or hand off the interruption to return automatically. Nested interruptions return in reverse order. “Not this” and shuffle remain deliberate ways to choose different work within Today.
5. **Review:** Dated tasks, due waiting follow-ups, and unfinished tasks from earlier days appear here. Review items do not automatically enter Focus. Choose Do today or reschedule them in their details. Waiting cards accept an exact follow-up date; without one, the existing 1/2/3/7-day interval applies. Nudged restarts that interval and clears an exact date.
6. **Weekly sweep:** Review links to an All tasks filter for later work without a review date. Search remains available across titles, notes, and owners.

## Dates and limits

All planning dates use America/New_York (Eastern time), including daylight saving time, so your phone and computer agree. After midnight, unfinished Today cards move out of the working view and remain visible in Review. Nothing is deleted, and Yesterday's plan does not silently become Today's plan.

Review dates are reminders to reconsider or follow up, not legal due dates. Deadline fields and claim/project grouping are not part of this release. Keep using the firm's calendar for deadlines. No automatic Outlook capture, emails, push notifications, or closed-browser alerts were added: reminders are visible when you open the app.

## Validation

39 automated tests cover task behavior, server authentication, multi-device saves, local attachments, print safety, legacy migration, date rollover/DST, scheduled reviews, interruption/resume, and undo. Production build passes. Interactive browser testing was attempted but could not run because the browser download failed in the build environment.
