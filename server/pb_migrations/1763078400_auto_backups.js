/// <reference path="../pb_data/types.d.ts" />

// Daily backups: at 03:30 UTC (PocketBase's schedules run in UTC, whatever
// the server's own time zone) the server zips its data (recipes, photos,
// lists, accounts) into pb_data/backups and keeps the last 7. Copy them off
// the server now and then (npm run backup), since they sit on the same disk.
// A server that already has a backup schedule keeps its own. Phones run this
// too but never make them (mobile/bentoserver/server.go switches them off).

migrate((app) => {
  const settings = app.settings();
  if (settings.backups.cron) return;
  settings.backups.cron = "30 3 * * *";
  settings.backups.cronMaxKeep = 7;
  app.save(settings);
}, (app) => {
  const settings = app.settings();
  if (settings.backups.cron !== "30 3 * * *") return;
  settings.backups.cron = "";
  app.save(settings);
});
