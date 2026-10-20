// authorizer is the private mandate-policy-v1 authorizer. It signs an MPC request
// only after the policy service reconstructs the same request from stored records.
package main

import (
	"crypto/ed25519"
	"encoding/hex"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/fystack/mpcium/pkg/client"
	"github.com/fystack/mpcium/pkg/types"
	"mandate.local/mpc-authorizer/internal"
)

func must(err error) {
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func secret(name string) string {
	path := os.Getenv(name)
	if path == "" {
		must(fmt.Errorf("%s is required", name))
	}
	b, err := os.ReadFile(path)
	must(err)
	return strings.TrimSpace(string(b))
}

func main() {
	listen := os.Getenv("AUTHORIZER_LISTEN")
	host, _, err := net.SplitHostPort(listen)
	must(err)
	if ip := net.ParseIP(host); ip == nil || !ip.IsLoopback() {
		must(errors.New("AUTHORIZER_LISTEN must be a loopback address"))
	}
	initiator, err := hex.DecodeString(os.Getenv("AUTHORIZER_INITIATOR_PUBLIC_KEY"))
	if err != nil || len(initiator) != ed25519.PublicKeySize {
		must(errors.New("AUTHORIZER_INITIATOR_PUBLIC_KEY must be a hex Ed25519 public key"))
	}
	signer, err := client.NewLocalSigner(types.EventInitiatorKeyTypeEd25519, client.LocalSignerOptions{
		KeyPath:   os.Getenv("AUTHORIZER_KEY_FILE"),
		Encrypted: true,
		Password:  secret("AUTHORIZER_KEY_PASSWORD_FILE"),
	})
	must(err)
	service := internal.Service{
		Policy: internal.PolicyClient{
			URL:   os.Getenv("POLICY_URL"),
			Token: secret("POLICY_INTERNAL_TOKEN_FILE"),
			HTTP:  &http.Client{Timeout: 10 * time.Second},
		},
		Initiator: initiator,
		Signer:    signer,
	}
	server := &http.Server{
		Addr:              listen,
		Handler:           service.Handler(secret("AUTHORIZER_INTERNAL_TOKEN_FILE")),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      20 * time.Second,
	}
	must(server.ListenAndServe())
}
