// Package bentoserver runs Bento's server inside the Android app, for
// phone-only mode: the same PocketBase as the household Pi, with Bento's
// hooks and migrations (server/pb_hooks, server/pb_migrations, copied out of
// the app), listening only on this phone (127.0.0.1) while the app is open.
//
// It's built into an Android library with gomobile (see mobile/README.md);
// the app's BentoLocalServerPlugin calls it. gomobile turns these functions
// into Java methods: Bentoserver.start(...), .stop(), .backup(), .restore().
package bentoserver

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/jsvm"
	"github.com/pocketbase/pocketbase/tools/archive"
)

var (
	mu      sync.Mutex
	app     *pocketbase.PocketBase
	port    int
	stopped chan error
	// What the server was last started with, for restarting after a restore.
	lastDirs [3]string
)

// Start starts the server, if it isn't running already, and returns the port
// it listens on. dataDir holds the database and photos; hooksDir and
// migrationsDir hold Bento's server code. It returns once the server answers,
// or with the reason it couldn't start.
func Start(dataDir, hooksDir, migrationsDir string) (int, error) {
	mu.Lock()
	defer mu.Unlock()
	if app != nil {
		return port, nil
	}
	return start(dataDir, hooksDir, migrationsDir)
}

func start(dataDir, hooksDir, migrationsDir string) (int, error) {
	lastDirs = [3]string{dataDir, hooksDir, migrationsDir}
	pb := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: dataDir, HideStartBanner: true})
	jsvm.MustRegister(pb, jsvm.Config{HooksDir: hooksDir, MigrationsDir: migrationsDir})
	// Bento's own setup screen makes the first account (see the setup_admin
	// migration), so never try to open PocketBase's installer page.
	pb.OnServe().BindFunc(func(e *core.ServeEvent) error {
		e.InstallerFunc = nil
		return e.Next()
	})
	if err := pb.Bootstrap(); err != nil {
		return 0, fmt.Errorf("couldn't open Bento's data: %w", err)
	}

	free, err := freePort()
	if err != nil {
		_ = pb.ClearBootstrap()
		return 0, err
	}
	done := make(chan error, 1)
	go func() {
		done <- apis.Serve(pb, apis.ServeConfig{HttpAddr: fmt.Sprintf("127.0.0.1:%d", free)})
	}()

	// Wait until it answers (the first start applies every migration).
	health := fmt.Sprintf("http://127.0.0.1:%d/api/health", free)
	deadline := time.Now().Add(60 * time.Second)
	for {
		select {
		case err := <-done:
			_ = pb.ClearBootstrap()
			if err == nil {
				err = errors.New("it stopped straight away")
			}
			return 0, fmt.Errorf("Bento's server didn't start: %w", err)
		default:
		}
		if response, err := http.Get(health); err == nil {
			response.Body.Close()
			if response.StatusCode == http.StatusOK {
				break
			}
		}
		if time.Now().After(deadline) {
			stopApp(pb)
			return 0, errors.New("Bento's server took too long to start")
		}
		time.Sleep(100 * time.Millisecond)
	}
	app, port, stopped = pb, free, done
	return port, nil
}

// A port nothing else on the phone is using.
func freePort() (int, error) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, fmt.Errorf("no free port for Bento's server: %w", err)
	}
	defer listener.Close()
	return listener.Addr().(*net.TCPAddr).Port, nil
}

// Stop stops the server, if it's running, closing the database cleanly.
func Stop() {
	mu.Lock()
	defer mu.Unlock()
	if app == nil {
		return
	}
	stopApp(app)
	select {
	case <-stopped:
	case <-time.After(10 * time.Second):
	}
	app = nil
}

// Like PocketBase's own shutdown: stops the web server, then the database.
func stopApp(pb *pocketbase.PocketBase) {
	event := new(core.TerminateEvent)
	event.App = pb
	_ = pb.OnTerminate().Trigger(event, func(e *core.TerminateEvent) error {
		return e.App.ClearBootstrap()
	})
}

// Backup writes a backup of everything (recipes, photos, lists, accounts)
// and returns the zip file's path, for the app to save where the person
// chooses. It's the same kind of backup a PocketBase server makes, so it can
// also be restored on a real server later. Only the newest one is kept.
func Backup() (string, error) {
	mu.Lock()
	defer mu.Unlock()
	if app == nil {
		return "", errors.New("Bento's server isn't running")
	}
	folder := filepath.Join(app.DataDir(), "backups")
	old, _ := filepath.Glob(filepath.Join(folder, "bento-*.zip"))
	for _, file := range old {
		_ = os.Remove(file)
	}
	name := "bento-" + time.Now().Format("2006-01-02-150405") + ".zip"
	if err := app.CreateBackup(context.Background(), name); err != nil {
		return "", fmt.Errorf("couldn't make the backup: %w", err)
	}
	return filepath.Join(folder, name), nil
}

// Restore replaces everything with a backup zip (from Backup, or from a
// PocketBase server), then starts the server again and returns its port. If
// the backup can't be used, the data from before is put back.
func Restore(zipPath string) (int, error) {
	mu.Lock()
	defer mu.Unlock()
	if app == nil {
		return 0, errors.New("Bento's server isn't running")
	}
	dataDir, hooksDir, migrationsDir := lastDirs[0], lastDirs[1], lastDirs[2]

	// Unpack it next to the data first, so a bad file changes nothing.
	incoming := dataDir + "-restoring"
	_ = os.RemoveAll(incoming)
	if err := archive.Extract(zipPath, incoming); err != nil {
		return port, fmt.Errorf("that file isn't a Bento backup: %w", err)
	}
	if _, err := os.Stat(filepath.Join(incoming, "data.db")); err != nil {
		_ = os.RemoveAll(incoming)
		return port, errors.New("that file isn't a Bento backup (it has no data.db)")
	}

	stopApp(app)
	select {
	case <-stopped:
	case <-time.After(10 * time.Second):
	}
	app = nil

	previous := dataDir + "-previous"
	_ = os.RemoveAll(previous)
	if err := os.Rename(dataDir, previous); err != nil {
		_ = os.RemoveAll(incoming)
		started, startErr := start(dataDir, hooksDir, migrationsDir)
		return started, errors.Join(fmt.Errorf("couldn't move the old data aside: %w", err), startErr)
	}
	// Keep this phone's own backups folder.
	_ = os.Rename(filepath.Join(previous, "backups"), filepath.Join(incoming, "backups"))
	if err := os.Rename(incoming, dataDir); err != nil {
		_ = os.Rename(previous, dataDir)
		started, startErr := start(dataDir, hooksDir, migrationsDir)
		return started, errors.Join(fmt.Errorf("couldn't put the backup in place: %w", err), startErr)
	}

	started, err := start(dataDir, hooksDir, migrationsDir)
	if err != nil {
		// The backup wouldn't start: put the old data back.
		_ = os.RemoveAll(dataDir)
		_ = os.Rename(previous, dataDir)
		started, startErr := start(dataDir, hooksDir, migrationsDir)
		return started, errors.Join(fmt.Errorf("the backup wouldn't open, so nothing was changed: %w", err), startErr)
	}
	_ = os.RemoveAll(previous)
	return started, nil
}
