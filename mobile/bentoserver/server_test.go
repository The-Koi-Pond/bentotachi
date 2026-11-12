package bentoserver

// Runs the phone server on the PC with Bento's real hooks and migrations:
// from the mobile folder, `go test ./...`.

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestStartBackupRestore(t *testing.T) {
	server, _ := filepath.Abs(filepath.Join("..", "..", "server"))
	dataDir := filepath.Join(t.TempDir(), "pb_data")
	hooks, migrations := filepath.Join(server, "pb_hooks"), filepath.Join(server, "pb_migrations")

	port, err := Start(dataDir, hooks, migrations)
	if err != nil {
		t.Fatal(err)
	}
	defer Stop()
	again, err := Start(dataDir, hooks, migrations)
	if err != nil || again != port {
		t.Fatalf("starting twice should keep the same server: %d %v", again, err)
	}
	base := fmt.Sprintf("http://127.0.0.1:%d", port)

	call := func(method, path, token string, body any) map[string]any {
		t.Helper()
		data, _ := json.Marshal(body)
		request, _ := http.NewRequest(method, base+path, bytes.NewReader(data))
		request.Header.Set("Content-Type", "application/json")
		if token != "" {
			request.Header.Set("Authorization", token)
		}
		response, err := http.DefaultClient.Do(request)
		if err != nil {
			t.Fatal(err)
		}
		defer response.Body.Close()
		raw, _ := io.ReadAll(response.Body)
		if response.StatusCode >= 300 {
			t.Fatalf("%s %s: %d %s", method, path, response.StatusCode, raw)
		}
		var result map[string]any
		_ = json.Unmarshal(raw, &result)
		return result
	}

	// A new server needs setting up, through Bento's own setup step.
	if call("GET", "/api/cookbook/setup", "", nil)["needsSetup"] != true {
		t.Fatal("a new server should need setting up")
	}
	call("POST", "/api/cookbook/setup", "", map[string]string{"username": "sam", "name": "Sam", "password": "a-long-password"})
	token := call("POST", "/api/collections/users/auth-with-password", "", map[string]string{"identity": "sam", "password": "a-long-password"})["token"].(string)
	call("POST", "/api/collections/recipes/records", token, map[string]string{"title": "Soup"})

	zip, err := Backup()
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(zip); err != nil {
		t.Fatal("the backup file wasn't made:", err)
	}

	// Change something after the backup, then restore it.
	call("POST", "/api/collections/recipes/records", token, map[string]string{"title": "Pie"})
	port, err = Restore(zip)
	if err != nil {
		t.Fatal(err)
	}
	base = fmt.Sprintf("http://127.0.0.1:%d", port)
	token = call("POST", "/api/collections/users/auth-with-password", "", map[string]string{"identity": "sam", "password": "a-long-password"})["token"].(string)
	items := call("GET", "/api/collections/recipes/records", token, nil)["items"].([]any)
	if len(items) != 1 || items[0].(map[string]any)["title"] != "Soup" {
		t.Fatalf("after restoring, only Soup should be there: %v", items)
	}

	// Something that isn't a backup changes nothing.
	junk := filepath.Join(t.TempDir(), "junk.zip")
	_ = os.WriteFile(junk, []byte("not a zip"), 0o644)
	if _, err := Restore(junk); !errors.Is(err, errNotABackup) {
		t.Fatalf("restoring a junk file should say it isn't a backup: %v", err)
	}
	// A zip of something else says the same, and leaves nothing behind.
	other := zipHolding(t, "photo.jpg")
	if _, err := Restore(other); !errors.Is(err, errNotABackup) {
		t.Fatalf("restoring a zip with no data.db should say it isn't a backup: %v", err)
	}
	if _, err := os.Stat(lastDirs[0] + "-restoring"); !os.IsNotExist(err) {
		t.Fatalf("a refused restore should leave nothing unpacked: %v", err)
	}
	items = call("GET", "/api/collections/recipes/records", token, nil)["items"].([]any)
	if len(items) != 1 {
		t.Fatalf("a failed restore shouldn't change anything: %v", items)
	}

	// Rescue: with the server stopped (as when it won't start), the data
	// still comes out as a backup that restores elsewhere.
	if _, err := Rescue(dataDir); err == nil {
		t.Fatal("rescuing while the server runs should fail")
	}
	Stop()
	rescued, err := Rescue(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	fresh := filepath.Join(t.TempDir(), "pb_data")
	port, err = Start(fresh, hooks, migrations)
	if err != nil {
		t.Fatal(err)
	}
	port, err = Restore(rescued)
	if err != nil {
		t.Fatal(err)
	}
	base = fmt.Sprintf("http://127.0.0.1:%d", port)
	token = call("POST", "/api/collections/users/auth-with-password", "", map[string]string{"identity": "sam", "password": "a-long-password"})["token"].(string)
	items = call("GET", "/api/collections/recipes/records", token, nil)["items"].([]any)
	if len(items) != 1 || items[0].(map[string]any)["title"] != "Soup" {
		t.Fatalf("the rescued data should restore with Soup in it: %v", items)
	}
}

// A phone-only backup restored where its random password isn't known (a new
// phone, or after "Delete everything" and a fresh start under another name):
// its one account can be taken over with a new password, and its data is
// there. A household's backup, with several accounts, can't.
func TestTakeOverRestoredAccount(t *testing.T) {
	server, _ := filepath.Abs(filepath.Join("..", "..", "server"))
	hooks, migrations := filepath.Join(server, "pb_hooks"), filepath.Join(server, "pb_migrations")
	port, err := Start(filepath.Join(t.TempDir(), "pb_data"), hooks, migrations)
	if err != nil {
		t.Fatal(err)
	}
	defer Stop()
	base := fmt.Sprintf("http://127.0.0.1:%d", port)
	call := func(method, path, token string, body any) (int, map[string]any) {
		t.Helper()
		data, _ := json.Marshal(body)
		request, _ := http.NewRequest(method, base+path, bytes.NewReader(data))
		request.Header.Set("Content-Type", "application/json")
		if token != "" {
			request.Header.Set("Authorization", token)
		}
		response, err := http.DefaultClient.Do(request)
		if err != nil {
			t.Fatal(err)
		}
		defer response.Body.Close()
		raw, _ := io.ReadAll(response.Body)
		var result map[string]any
		_ = json.Unmarshal(raw, &result)
		return response.StatusCode, result
	}
	login := func(username, password string) string {
		t.Helper()
		status, answer := call("POST", "/api/collections/users/auth-with-password", "", map[string]string{"identity": username, "password": password})
		if status != 200 {
			return ""
		}
		return answer["token"].(string)
	}

	// The first phone: account "sam", a recipe, a backup.
	call("POST", "/api/cookbook/setup", "", map[string]string{"username": "sam", "name": "Sam", "password": "first-phones-secret"})
	call("POST", "/api/collections/recipes/records", login("sam", "first-phones-secret"), map[string]string{"title": "Soup"})
	backup, err := Backup()
	if err != nil {
		t.Fatal(err)
	}
	kept := filepath.Join(t.TempDir(), "sams-backup.zip")
	if data, err := os.ReadFile(backup); err != nil || os.WriteFile(kept, data, 0o644) != nil {
		t.Fatal("couldn't keep the backup", err)
	}

	// "Delete everything", then a fresh start as someone else.
	Stop()
	port, err = Start(filepath.Join(t.TempDir(), "pb_data"), hooks, migrations)
	if err != nil {
		t.Fatal(err)
	}
	base = fmt.Sprintf("http://127.0.0.1:%d", port)
	call("POST", "/api/cookbook/setup", "", map[string]string{"username": "fresh", "name": "Fresh", "password": "new-phones-secret"})

	// Restored: the phone's saved login no longer works, as the tester found.
	if port, err = Restore(kept); err != nil {
		t.Fatal(err)
	}
	base = fmt.Sprintf("http://127.0.0.1:%d", port)
	if login("fresh", "new-phones-secret") != "" {
		t.Fatal("the account from before the restore shouldn't exist any more")
	}
	username, err := OnlyAccount()
	if err != nil || username != "sam" {
		t.Fatalf("the backup's one account should be sam: %q %v", username, err)
	}
	if err := SetPassword(username, "new-phones-secret"); err != nil {
		t.Fatal(err)
	}
	token := login("sam", "new-phones-secret")
	if token == "" {
		t.Fatal("the taken-over account should log in with the phone's new password")
	}
	if login("sam", "first-phones-secret") != "" {
		t.Fatal("the old password shouldn't work any more")
	}
	// The admin login Backups shows (username@bento.local, same password)
	// follows, for moving the data to a server later.
	adminLogin := func(password string) int {
		status, _ := call("POST", "/api/collections/_superusers/auth-with-password", "", map[string]string{"identity": "sam@bento.local", "password": password})
		return status
	}
	if adminLogin("new-phones-secret") != 200 || adminLogin("first-phones-secret") == 200 {
		t.Fatal("the admin account should take the new password too, and only it")
	}
	status, recipes := call("GET", "/api/collections/recipes/records", token, nil)
	if status != 200 || len(recipes["items"].([]any)) != 1 {
		t.Fatalf("the backup's recipe should be there: %d %v", status, recipes)
	}

	// A household's backup has several accounts: nobody's taken over.
	call("POST", "/api/collections/users/records", token, map[string]string{"username": "alex", "password": "alexs-password", "passwordConfirm": "alexs-password"})
	if username, err := OnlyAccount(); err != nil || username != "" {
		t.Fatalf("with two accounts there's no one to take over: %q %v", username, err)
	}
	if err := SetPassword("nobody", "x-long-password"); err == nil {
		t.Fatal("setting the password of an account that isn't there should fail")
	}
}

// The phone makes no nightly backups, though the auto_backups migration
// still stores the household servers' schedule, and the next backup tidies
// away nightly ones an earlier version left behind.
func TestNoNightlyBackups(t *testing.T) {
	server, _ := filepath.Abs(filepath.Join("..", "..", "server"))
	dataDir := filepath.Join(t.TempDir(), "pb_data")
	hooks, migrations := filepath.Join(server, "pb_hooks"), filepath.Join(server, "pb_migrations")
	if _, err := Start(dataDir, hooks, migrations); err != nil {
		t.Fatal(err)
	}
	defer Stop()

	var stored string
	if err := app.DB().NewQuery("SELECT value FROM _params WHERE id = 'settings'").Row(&stored); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(stored, `"cron":"30 3 * * *"`) {
		t.Fatalf("the migration's schedule should still be stored, for restoring on a server: %s", stored)
	}
	noJob := func(when string) {
		t.Helper()
		for _, job := range app.Cron().Jobs() {
			if job.Id() == autoBackupJob {
				t.Fatalf("%s: the nightly backup job shouldn't be scheduled on a phone", when)
			}
		}
	}
	noJob("after starting")
	if err := app.ReloadSettings(); err != nil {
		t.Fatal(err)
	}
	noJob("after the settings reload")
	// Started again: the migration has run, so nothing reloads the settings
	// after PocketBase schedules the job at start-up.
	Stop()
	if _, err := Start(dataDir, hooks, migrations); err != nil {
		t.Fatal(err)
	}
	noJob("after starting again")

	folder := filepath.Join(dataDir, "backups")
	_ = os.MkdirAll(folder, 0o755)
	nightly := filepath.Join(folder, "@auto_pb_backup_bentotachi_20261101033000.zip")
	if err := os.WriteFile(nightly, []byte("an old nightly backup"), 0o644); err != nil {
		t.Fatal(err)
	}
	made, err := Backup()
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(nightly); !os.IsNotExist(err) {
		t.Fatalf("an old nightly backup should be deleted by the next backup: %v", err)
	}
	if _, err := os.Stat(made); err != nil {
		t.Fatalf("the new backup should be there: %v", err)
	}
}

// A backup that won't open leaves everything as it was, the phone's own
// backups folder included.
func TestBadBackupKeepsBackups(t *testing.T) {
	server, _ := filepath.Abs(filepath.Join("..", "..", "server"))
	dataDir := filepath.Join(t.TempDir(), "pb_data")
	hooks, migrations := filepath.Join(server, "pb_hooks"), filepath.Join(server, "pb_migrations")
	if _, err := Start(dataDir, hooks, migrations); err != nil {
		t.Fatal(err)
	}
	defer Stop()
	made, err := Backup()
	if err != nil {
		t.Fatal(err)
	}

	bad := filepath.Join(t.TempDir(), "bad.zip")
	file, _ := os.Create(bad)
	writer := zip.NewWriter(file)
	entry, _ := writer.Create("data.db")
	_, _ = entry.Write([]byte("not a database, just text"))
	_ = writer.Close()
	_ = file.Close()

	if _, err := Restore(bad); err == nil {
		t.Fatal("a backup that isn't a database should fail to restore")
	}
	if _, err := os.Stat(filepath.Join(dataDir, "data.db")); err != nil {
		t.Fatalf("the old data should be back: %v", err)
	}
	if _, err := os.Stat(made); err != nil {
		t.Fatalf("the phone's earlier backup should still be there: %v", err)
	}
}

// A real zip holding one small file by this name, and nothing else.
func zipHolding(t *testing.T, name string) string {
	path := filepath.Join(t.TempDir(), "other.zip")
	file, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	writer := zip.NewWriter(file)
	entry, _ := writer.Create(name)
	_, _ = entry.Write([]byte("something else"))
	_ = writer.Close()
	_ = file.Close()
	return path
}
