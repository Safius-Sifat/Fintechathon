// adapter is the worker-only MPC signing service. It signs committed Actions by
// ID through the pinned upstream client; it has no raw digest or reshare route.
package main

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/fystack/mpcium/pkg/client"
	"github.com/fystack/mpcium/pkg/types"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nats-io/nats.go"
	"mandate.local/mpc-adapter/internal"
	boundary "mandate.local/mpc-boundary"
)

func must(err error) {
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func required(name string) string {
	v := os.Getenv(name)
	if v == "" {
		must(fmt.Errorf("%s is required", name))
	}
	return v
}

func secret(name string) string {
	b, err := os.ReadFile(required(name))
	must(err)
	return strings.TrimSpace(string(b))
}

func loopback(addr string) {
	host, _, err := net.SplitHostPort(addr)
	must(err)
	if ip := net.ParseIP(host); ip == nil || !ip.IsLoopback() {
		must(errors.New(addr + " must be a loopback address"))
	}
}

func main() {
	listen := required("ADAPTER_LISTEN")
	loopback(listen)
	// One process may hold the stable upstream client ID.
	lock, err := os.OpenFile(required("ADAPTER_LOCK_FILE"), os.O_CREATE|os.O_RDWR, 0o600)
	must(err)
	must(syscall.Flock(int(lock.Fd()), syscall.LOCK_EX|syscall.LOCK_NB))

	// verify-full with an explicit root certificate: no plaintext or unverified fallback.
	url := required("ADAPTER_DATABASE_URL")
	if !strings.Contains(url, "sslmode=verify-full") || !strings.Contains(url, "sslrootcert=") {
		must(errors.New("ADAPTER_DATABASE_URL must use sslmode=verify-full with sslrootcert"))
	}
	cfg, err := pgxpool.ParseConfig(url)
	must(err)
	cfg.MaxConns = 4
	db, err := pgxpool.NewWithConfig(context.Background(), cfg)
	must(err)
	defer db.Close()

	tlsDir := required("NATS_TLS_DIR")
	nc, err := nats.Connect(required("NATS_URL"),
		nats.UserInfo(required("NATS_USER"), secret("NATS_PASSWORD_FILE")),
		nats.RootCAs(filepath.Join(tlsDir, "ca.crt")),
		nats.ClientCert(filepath.Join(tlsDir, "transport.crt"), filepath.Join(tlsDir, "transport.key")),
		nats.Timeout(5*time.Second))
	must(err)
	defer nc.Close()
	signer, err := client.NewLocalSigner(types.EventInitiatorKeyTypeEd25519, client.LocalSignerOptions{
		KeyPath: required("INITIATOR_KEY_FILE"), Encrypted: true, Password: secret("INITIATOR_KEY_PASSWORD_FILE"),
	})
	must(err)
	mpc := client.NewMPCClient(client.Options{NatsConn: nc, Signer: signer, ClientID: boundary.ClientID})
	authorizer := internal.AuthorizerClient{URL: required("AUTHORIZER_URL"), Token: secret("AUTHORIZER_INTERNAL_TOKEN_FILE"), HTTP: &http.Client{Timeout: 20 * time.Second}}
	store := internal.PgStore{DB: db}
	adapter, err := internal.New(store, authorizer, signer, mpc)
	must(err)
	// A session outlives the head-of-line delay of queued unauthorized requests;
	// past it the attempt stays UNKNOWN until a late result or reconciliation.
	session := 15 * time.Minute
	if v := os.Getenv("ADAPTER_SESSION_TIMEOUT"); v != "" {
		session, err = time.ParseDuration(v)
		must(err)
	}
	keygen, err := internal.NewKeygen(store, authorizer, signer, mpc, 10*time.Minute)
	must(err)
	server := &http.Server{
		Addr:              listen,
		Handler:           internal.Handler(adapter, keygen, store, secret("ADAPTER_INTERNAL_TOKEN_FILE"), session),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      20 * time.Second,
	}
	must(server.ListenAndServe())
}
