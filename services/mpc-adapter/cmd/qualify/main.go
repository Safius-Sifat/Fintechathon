// qualify runs an isolated local ceremony. It exposes no HTTP endpoint and never
// imports a full ECDSA key. Public output contains only qualification vectors.
package main

import (
	"context"
	"crypto/ed25519"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	secp "github.com/decred/dcrd/dcrec/secp256k1/v4"
	"github.com/fystack/mpcium/pkg/client"
	"github.com/fystack/mpcium/pkg/event"
	"github.com/fystack/mpcium/pkg/types"
	"github.com/google/uuid"
	"github.com/nats-io/nats.go"
	"mandate.local/mpc-adapter/internal/qualification"
	boundary "mandate.local/mpc-boundary"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"time"
)

func readJSON(path string, out interface{}) {
	b, e := os.ReadFile(path)
	must(e)
	must(json.Unmarshal(b, out))
}
func must(err error) {
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
func signer(dir, name string) client.Signer {
	p, e := os.ReadFile(filepath.Join(dir, "password"))
	must(e)
	s, e := client.NewLocalSigner(types.EventInitiatorKeyTypeEd25519, client.LocalSignerOptions{KeyPath: filepath.Join(dir, name), Encrypted: true, Password: string(p)})
	must(e)
	return s
}

type output struct {
	WalletID  string       `json:"walletId"`
	Executor  string       `json:"executor"`
	PublicKey string       `json:"publicKey"`
	Cases     []caseResult `json:"cases"`
}
type caseResult struct {
	Name       string `json:"name"`
	Result     string `json:"result"`
	DurationMS int64  `json:"durationMs"`
	Digest     string `json:"digest,omitempty"`
	Signature  string `json:"signature,omitempty"`
	Error      string `json:"error,omitempty"`
}

func main() {
	if len(os.Args) != 2 {
		must(errors.New("usage: qualify dkg|sign|sign20|deny-missing|deny-wrong|deny-initiator|deny-mutated|post-denial-recovery|transport-denial"))
	}
	switch os.Args[1] {
	case "dkg", "sign", "sign20", "deny-missing", "deny-wrong", "deny-initiator", "deny-mutated", "post-denial-recovery", "transport-denial":
	default:
		must(errors.New("unsupported qualification operation"))
	}
	dir := os.Getenv("MPC_PRIVATE_DIR")
	if dir == "" {
		must(errors.New("MPC_PRIVATE_DIR required"))
	}
	var transport struct {
		NatsPassword string
		ConsulToken  string
	}
	readJSON(filepath.Join(dir, "transport.json"), &transport)
	tlsDir := filepath.Join(dir, "tls")
	opts := []nats.Option{nats.UserInfo("mandate", transport.NatsPassword), nats.RootCAs(filepath.Join(tlsDir, "ca.crt")), nats.ClientCert(filepath.Join(tlsDir, "transport.crt"), filepath.Join(tlsDir, "transport.key")), nats.Timeout(5 * time.Second), nats.MaxReconnects(0)}
	if os.Args[1] == "transport-denial" {
		opts[0] = nats.UserInfo("mandate", "wrong")
		c, e := nats.Connect("tls://127.0.0.1:14222", opts...)
		if c != nil {
			c.Close()
		}
		if e == nil {
			must(errors.New("unauthorized NATS connection accepted"))
		}
		fmt.Println(`{"name":"nats-wrong-credentials","result":"LOCAL_PASS"}`)
		return
	}
	lock, e := os.OpenFile(filepath.Join(dir, "mandate-adapter-a.lock"), os.O_CREATE|os.O_RDWR, 0600)
	must(e)
	defer lock.Close()
	must(syscall.Flock(int(lock.Fd()), syscall.LOCK_EX|syscall.LOCK_NB))
	defer syscall.Flock(int(lock.Fd()), syscall.LOCK_UN)
	nc, e := nats.Connect("tls://127.0.0.1:14222", opts...)
	must(e)
	defer nc.Close()
	init := signer(filepath.Join(dir, "initiator"), "mandate-adapter-a.key.age")
	author := signer(filepath.Join(dir, "authorizer"), "mandate-policy-v1.authorizer.key.age")
	c := client.NewMPCClient(client.Options{NatsConn: nc, Signer: init, ClientID: boundary.ClientID})
	walletBytes, e := os.ReadFile(filepath.Join(dir, "wallet-id"))
	must(e)
	wallet := strings.TrimSpace(string(walletBytes))
	parsedWallet, err := uuid.Parse(wallet)
	must(err)
	if parsedWallet.String() != wallet {
		must(errors.New("canonical wallet UUID required"))
	}
	var out output
	out.WalletID = wallet
	mode := os.Args[1]
	if mode == "dkg" {
		if _, err := os.Stat(filepath.Join(dir, "public-wallet.json")); err == nil {
			must(errors.New("completed qualification wallet exists; refusing repeated DKG"))
		}
		ch := make(chan event.KeygenResultEvent, 8)
		must(c.OnWalletCreationResult(func(r event.KeygenResultEvent) {
			if r.WalletID == wallet {
				select {
				case ch <- r:
				default:
				}
			}
		}))
		m := &types.GenerateKeyMessage{WalletID: wallet}
		raw, e := m.Raw()
		must(e)
		m.Signature, e = init.Sign(raw)
		must(e)
		raw, e = types.ComposeAuthorizerRaw(m)
		must(e)
		sig, e := author.Sign(raw)
		must(e)
		start := time.Now()
		must(c.CreateWalletWithAuthorizers(wallet, []types.AuthorizerSignature{{AuthorizerID: boundary.AuthorizerID, Signature: sig}}))
		select {
		case r := <-ch:
			if r.ResultType != event.ResultTypeSuccess {
				must(fmt.Errorf("DKG failed: %s", r.ErrorReason))
			}
			if len(r.ECDSAPubKey) != 64 {
				must(errors.New("upstream ECDSA key must be X||Y (64 bytes)"))
			}
			pub, e := secp.ParsePubKey(append([]byte{4}, r.ECDSAPubKey...))
			must(e)
			out.Executor = boundary.Address(pub)
			out.PublicKey = hex.EncodeToString(r.ECDSAPubKey)
			out.Cases = []caseResult{{Name: "dkg-three-nodes", Result: "LOCAL_PASS", DurationMS: time.Since(start).Milliseconds()}}
			b, _ := json.MarshalIndent(out, "", "  ")
			must(os.WriteFile(filepath.Join(dir, "public-wallet.json"), b, 0600))
			fmt.Println(string(b))
		case <-time.After(10 * time.Minute):
			must(errors.New("MPC_TOPOLOGY_BLOCKED: DKG timeout after 10m"))
		}
		return
	}
	readJSON(filepath.Join(dir, "public-wallet.json"), &out)
	out.Cases = nil
	ch := make(chan event.SigningResultEvent, 32)
	must(c.OnSignResult(func(r event.SigningResultEvent) {
		select {
		case ch <- r:
		default:
		}
	}))
	var vectors []struct {
		ID             string `json:"id"`
		Digest         string `json:"digest"`
		ExpectedDigest string `json:"expectedDigest"`
	}
	readJSON(filepath.Join(dir, "digests.json"), &vectors)
	pubHex, e := init.PublicKey()
	must(e)
	pub, e := hex.DecodeString(pubHex)
	must(e)
	// prepare authorizes a committed record, then applies the denial mutation so
	// the nodes, not the local authorizer, must reject it.
	prepare := func(name string, i int) pending {
		v := vectors[i%len(vectors)]
		if v.Digest != v.ExpectedDigest {
			must(errors.New("shared helper digest mismatch"))
		}
		d, e := hex.DecodeString(strings.TrimPrefix(v.Digest, "0x"))
		must(e)
		if len(d) != 32 {
			must(errors.New("digest length"))
		}
		var digest [32]byte
		copy(digest[:], d)
		// Public leading-zero vector exercises raw32 without changing the shared Action vector.
		if i == 19 {
			digest[0] = 0
		}
		r := boundary.Record{ActionID: "qualification-" + uuid.NewString(), AttemptID: uuid.NewString(), WalletID: wallet, KeyVersion: "qualification-1", Executor: out.Executor, Digest: digest}
		records := qualification.NewRecords()
		must(records.Commit(r))
		a, e := boundary.NewAuthorizer(records, records, ed25519.PublicKey(pub), author)
		must(e)
		m, e := boundary.Message(r, init)
		must(e)
		auth, e := a.Authorize(context.Background(), r.ActionID, r.AttemptID, m)
		must(e)
		m.AuthorizerSignatures = []types.AuthorizerSignature{auth}
		switch name {
		case "deny-missing":
			m.AuthorizerSignatures = nil
		case "deny-wrong":
			m.AuthorizerSignatures[0].Signature = make([]byte, 64)
		case "deny-initiator":
			m.Tx[0] ^= 1
		case "deny-mutated":
			// A valid initiator signature over the mutated request leaves only the
			// authorizer binding to reject it.
			m.Tx[0] ^= 1
			raw, e := m.Raw()
			must(e)
			m.Signature, e = init.Sign(raw)
			must(e)
		}
		return pending{name: name, attempt: r.AttemptID, digest: digest, msg: m, expectFail: strings.HasPrefix(name, "deny-") || os.Getenv("MPC_EXPECT_FAILURE") == "1"}
	}
	// await publishes the batch and collects one terminal result per attempt;
	// results for another wallet, attempt or network never satisfy a request.
	await := func(batch []pending, timeout time.Duration) {
		start := time.Now()
		results := map[string]*caseResult{}
		for _, p := range batch {
			results[p.attempt] = &caseResult{Name: p.name, Digest: "0x" + hex.EncodeToString(p.digest[:])}
			must(c.SignTransaction(p.msg))
		}
		timer := time.NewTimer(timeout)
		defer timer.Stop()
	wait:
		for open := len(batch); open > 0; {
			select {
			case e := <-ch:
				res, ok := results[e.TxID]
				if !ok || res.Result != "" || e.WalletID != wallet || e.NetworkInternalCode != boundary.Network {
					continue
				}
				open--
				res.DurationMS = time.Since(start).Milliseconds()
				if e.ResultType != event.ResultTypeSuccess {
					res.Result = "DENIED"
					res.Error = e.ErrorReason
					continue
				}
				digest, err := hex.DecodeString(strings.TrimPrefix(res.Digest, "0x"))
				must(err)
				sig, err := boundary.Normalize([32]byte(digest), e.R, e.S, e.SignatureRecovery, out.Executor)
				must(err)
				res.Result = "LOCAL_PASS"
				res.Signature = "0x" + hex.EncodeToString(sig)
			case <-timer.C:
				break wait
			}
		}
		for _, p := range batch {
			res := results[p.attempt]
			if res.Result == "" {
				res.Result = "TIMEOUT_NO_SIGNATURE"
				res.DurationMS = time.Since(start).Milliseconds()
			}
			out.Cases = append(out.Cases, *res)
			if p.expectFail && res.Signature != "" {
				must(errors.New("unexpected valid signature in denial case"))
			}
			if !p.expectFail && res.Signature == "" {
				b, _ := json.Marshal(out)
				fmt.Println(string(b))
				must(errors.New("MPC_TOPOLOGY_BLOCKED: signing failed"))
			}
		}
	}
	timeout := 90 * time.Second
	if strings.HasPrefix(mode, "deny-") || os.Getenv("MPC_EXPECT_FAILURE") == "1" {
		timeout = 20 * time.Second
	}
	if mode == "post-denial-recovery" {
		// Nodes drop unauthorized requests without replying, so each one holds the
		// single signing slot until JetStream exhausts redelivery.
		timeout = 20 * time.Minute
	}
	if v := os.Getenv("MPC_SIGN_TIMEOUT"); v != "" {
		timeout, e = time.ParseDuration(v)
		must(e)
	}
	switch mode {
	case "sign20":
		for i := 0; i < 20; i++ {
			await([]pending{prepare(mode, i)}, timeout)
		}
	case "post-denial-recovery":
		await([]pending{prepare("deny-missing", 0), prepare("deny-wrong", 0), prepare("deny-mutated", 0), prepare("sign", 0)}, timeout)
	default:
		await([]pending{prepare(mode, 0)}, timeout)
	}
	b, e := json.MarshalIndent(out, "", "  ")
	must(e)
	fmt.Println(string(b))
}

type pending struct {
	name, attempt string
	digest        [32]byte
	msg           *types.SignTxMessage
	expectFail    bool
}
