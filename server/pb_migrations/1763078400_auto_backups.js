/// <reference path="../pb_data/types.d.ts" />

// Nightly backups: at 3:30 am the server zips its data (recipes, photos,
// lists, accounts) into pb_data/backups and keeps the last 7. Copy them off
// the server now and then (npm run backup), since they sit on the same disk.
// A server that already has a backup schedule keeps its own.

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
